import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import type { Dirent } from 'fs'
import { execFileSync } from 'child_process'
import { tmpdir } from 'os'
import { basename, dirname, join, relative, resolve, sep } from 'path'
import type { AwesomePluginInfo, PluginManifest, SkillInfo } from '../../shared/types'

/* ==================== 类型 ==================== */

/** 解析后的 GitHub 仓库引用 */
export interface GitHubRef {
  owner: string
  repo: string
  /** 分支 / tag / commit sha，缺省 main */
  ref: string
  /** 仓库内插件子目录路径（如 plugins/some-plugin），空串表示仓库根 */
  subpath: string
}

/** .jeak-index.json 中单个插件的桥接条目 */
export interface BridgeEntry {
  /** 安装来源（原始 GitHub URL） */
  source: string
  /** 安装时间（ISO 8601） */
  installedAt: string
  /** 由官方 extensions.*.skills 声明解析出的 SKILL.md 文件绝对路径 */
  skillFiles: string[]
}

/** ~/.jeak/plugins/.jeak-index.json 顶层结构 */
export interface BridgeIndex {
  version: 1
  plugins: Record<string, BridgeEntry>
}

/** GitHub Contents API 返回的条目 */
interface GitHubItem {
  type: 'file' | 'dir' | 'symlink' | 'submodule'
  name: string
  path: string
  /** 仅 file 类型：原始内容地址（raw.githubusercontent.com） */
  download_url?: string | null
  /** 仅 file 且 < 1MB：base64 内容 */
  content?: string
  encoding?: string
}

const INDEX_FILE = '.jeak-index.json'
const GITHUB_HEADERS: Record<string, string> = {
  'User-Agent': 'jeak-agent',
  Accept: 'application/vnd.github+json'
}

/* ==================== URL 解析 ==================== */

/**
 * 解析 GitHub 仓库地址为结构化引用。
 * 支持：https://github.com/owner/repo 或
 *      https://github.com/owner/repo/tree/<ref>/<subpath>
 */
export function parseGitHubUrl(url: string): GitHubRef {
  const trimmed = url.trim().replace(/\/+$/, '')
  const m = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)(?:\/tree\/([^/?#]+)\/(.+))?$/)
  if (!m) {
    throw new Error(
      `无法解析 GitHub 地址（期望形如 https://github.com/owner/repo/tree/main/plugins/xxx）：${url}`
    )
  }
  return {
    owner: m[1],
    repo: m[2].replace(/\.git$/, ''),
    ref: m[3] ?? 'main',
    subpath: (m[4] ?? '').replace(/\/+$/, '')
  }
}

/* ==================== 网络层 ==================== */

function githubApiUrl(ref: GitHubRef, remotePath: string): string {
  const seg = remotePath.split('/').map(encodeURIComponent).join('/')
  return `https://api.github.com/repos/${ref.owner}/${ref.repo}/contents/${seg}?ref=${encodeURIComponent(ref.ref)}`
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: GITHUB_HEADERS })
  if (res.status === 404) throw new Error(`资源不存在 (404)：${url}`)
  if (res.status === 403 || res.status === 429) {
    throw new Error('GitHub API 访问受限或达到速率限制 (403/429)，请稍后重试')
  }
  if (!res.ok) throw new Error(`下载失败 (${res.status})：${url}`)
  return res.text()
}

async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url)) as T
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: GITHUB_HEADERS })
  if (!res.ok) throw new Error(`下载失败 (${res.status})：${url}`)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * 通过 Contents API 单文件端点读取文件内容。
 * 优先使用 base64 content（api.github.com 直连，避开 raw.githubusercontent.com 的 DNS 污染），
 * 仅当文件 >1MB（content 为 null）时才回退到 download_url。
 */
async function fetchFileContent(ref: GitHubRef, remotePath: string): Promise<Buffer> {
  const item = await fetchJson<GitHubItem>(githubApiUrl(ref, remotePath))
  if (item.content) {
    return Buffer.from(item.content, 'base64')
  }
  if (item.download_url) {
    try {
      return await fetchBuffer(item.download_url)
    } catch {
      throw new Error(`无法下载文件（raw 源不可达且无 content）：${remotePath}`)
    }
  }
  throw new Error(`无法读取文件内容（缺少 content 与 download_url）：${remotePath}`)
}

/* ==================== Tarball 批量下载（推荐路径） ==================== */

/** 下载整个仓库的 tarball（走 codeload.github.com，不消耗 Contents API 速率限制） */
async function fetchTarball(ref: GitHubRef): Promise<Buffer> {
  const url = `https://codeload.github.com/${ref.owner}/${ref.repo}/tar.gz/${encodeURIComponent(ref.ref)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'jeak-agent' } })
  if (!res.ok) throw new Error(`下载 tarball 失败 (${res.status})：${url}`)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * 通过 git tarball 一次性下载整个仓库并提取 subpath 到 destDir。
 * 相比逐文件请求 Contents API，只需 1 次请求且不受 core 速率限制，适合多文件插件。
 */
async function downloadSubpathViaTarball(ref: GitHubRef, subpath: string, destDir: string): Promise<void> {
  const tarball = await fetchTarball(ref)
  const workDir = mkdtempSync(join(tmpdir(), 'jeak-git-'))
  try {
    const tarFile = join(workDir, 'repo.tar.gz')
    const extractDir = join(workDir, 'extract')
    mkdirSync(extractDir, { recursive: true })
    writeFileSync(tarFile, tarball)

    execFileSync('tar', ['-xzf', tarFile, '-C', extractDir], { stdio: 'pipe' })

    // tarball 解压后第一层是 <repo>-<sha> 目录
    const top = readdirSync(extractDir, { withFileTypes: true }).filter((e) => e.isDirectory())
    if (top.length === 0) throw new Error('tarball 解压结果为空')
    const repoRoot = join(extractDir, top[0].name)

    const srcDir = join(repoRoot, subpath)
    if (!existsSync(srcDir)) {
      throw new Error(`tarball 中未找到插件子目录：${subpath}`)
    }
    cpSync(srcDir, destDir, { recursive: true })
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

/* ==================== 名称校验 ==================== */

/** 与 loader 一致的插件名校验（官方规则） */
function validatePluginName(name: unknown): string {
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('plugin.json 缺少合法的 name 字段')
  }
  const n = name.trim()
  if (!/^[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9]+)?$/.test(n) || n.includes('..') || n.includes('--')) {
    throw new Error(`插件名不合法（应为小写字母/数字/点/连字符，首尾字母数字）：${n}`)
  }
  return n
}

/* ==================== skills 声明解析 ==================== */

/** 将相对路径解析为插件目录内的安全绝对路径（越界/空返回 null，不检查存在性） */
function resolveWithinRoot(pluginDir: string, rel: string): string | null {
  if (typeof rel !== 'string' || !rel.trim()) return null
  const normalized = rel.replace(/\\/g, '/')
  if (normalized.startsWith('/') || normalized.startsWith('../') || normalized.includes('/../')) {
    return null
  }
  const root = resolve(pluginDir)
  const abs = resolve(root, rel)
  const relPath = relative(root, abs)
  if (relPath === '..' || relPath.startsWith(`..${sep}`)) return null
  return abs
}

/** 将声明中的单个相对路径解析为 SKILL.md 文件绝对路径（越界/不存在返回 null） */
function resolveSkillFile(pluginDir: string, rel: string): string | null {
  const abs = resolveWithinRoot(pluginDir, rel)
  if (!abs || !existsSync(abs)) return null
  try {
    const stat = statSync(abs)
    if (stat.isFile()) return abs.endsWith('.md') ? abs : null
    if (stat.isDirectory()) {
      const skillMd = join(abs, 'SKILL.md')
      return existsSync(skillMd) ? skillMd : null
    }
  } catch {
    return null
  }
  return null
}

/** 递归扫描目录下所有 SKILL.md 文件（用于 Copilot 顶层 skills 指向技能集合根目录的场景） */
function scanSkillDir(dir: string): string[] {
  const out: string[] = []
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      out.push(...scanSkillDir(full))
    } else if (e.isFile() && e.name.toLowerCase() === 'skill.md') {
      out.push(full)
    }
  }
  return out
}

/**
 * 提取插件声明的全部 SKILL.md 文件绝对路径（去重）。
 * 兼容两种主流格式：
 *  1) Agent Plugins 1.0：extensions.*.skills 字符串数组（每个指向单个 skill 目录或 .md 文件）
 *  2) GitHub Copilot 插件格式：顶层 skills 字段（字符串或字符串数组，可指向单个 skill 或技能集合根目录）
 */
export function extractSkillFiles(manifest: PluginManifest, pluginDir: string): string[] {
  const files = new Set<string>()
  const collect = (raw: unknown): void => {
    if (!raw) return
    const list = Array.isArray(raw) ? raw : [raw]
    for (const entry of list) {
      if (typeof entry !== 'string') continue
      // 1) 单个 skill（目录含 SKILL.md / 单个 .md 文件）
      const single = resolveSkillFile(pluginDir, entry)
      if (single) {
        files.add(single)
        continue
      }
      // 2) 技能集合根目录（Copilot 顶层 skills 常指向 skills/ 根目录）
      const abs = resolveWithinRoot(pluginDir, entry)
      if (!abs) continue
      try {
        if (existsSync(abs) && statSync(abs).isDirectory()) {
          for (const f of scanSkillDir(abs)) files.add(f)
        }
      } catch {
        /* ignore */
      }
    }
  }

  // 1) Agent Plugins 1.0：extensions.*.skills
  const extensions = manifest.extensions
  if (extensions && typeof extensions === 'object') {
    for (const value of Object.values(extensions)) {
      if (!value || typeof value !== 'object') continue
      collect((value as Record<string, unknown>).skills)
    }
  }

  // 2) GitHub Copilot 插件格式：顶层 skills
  collect(manifest.skills)

  return [...files]
}

/* ==================== SKILL.md 解析（与 loader 保持一致） ==================== */

function splitFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  const m = raw.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  if (!m) return { frontmatter: {}, body: raw }

  const frontmatter: Record<string, string> = {}
  let blockKey: 'name' | 'description' | null = null
  let blockIndent = 0
  let blockLines: string[] = []
  const flushBlock = (): void => {
    if (blockKey) frontmatter[blockKey] = blockLines.join(' ').trim()
    blockKey = null
    blockLines = []
  }

  for (const line of m[1].split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '') {
      flushBlock()
      continue
    }
    const indent = line.match(/^[ \t]*/)?.[0].length ?? 0

    // YAML 块标量续行（description: >- 后的缩进行）
    if (blockKey !== null && indent > blockIndent) {
      blockLines.push(trimmed)
      continue
    }
    flushBlock()

    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    if (key !== 'name' && key !== 'description') continue
    let val = line.slice(idx + 1).trim()

    if (val === '>-' || val === '|-' || val === '>' || val === '|') {
      blockKey = key
      blockIndent = indent
      blockLines = []
      continue
    }

    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    frontmatter[key] = val
  }
  flushBlock()

  return { frontmatter, body: raw.slice(m[0].length) }
}

function parseSkillFromFile(filePath: string): SkillInfo | null {
  let raw: string
  try {
    raw = readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
  const fallbackName = basename(dirname(filePath))
  const { frontmatter, body } = splitFrontmatter(raw)
  const name =
    typeof frontmatter.name === 'string' && frontmatter.name.trim()
      ? frontmatter.name.trim()
      : fallbackName
  const description = typeof frontmatter.description === 'string' ? frontmatter.description : ''
  return { name, description, path: dirname(filePath), body }
}

/* ==================== .jeak-index.json 读写 ==================== */

export function readBridgeIndex(pluginsRoot: string): BridgeIndex {
  try {
    const parsed = JSON.parse(readFileSync(join(pluginsRoot, INDEX_FILE), 'utf-8'))
    if (parsed && typeof parsed === 'object' && parsed.plugins && typeof parsed.plugins === 'object') {
      return { version: 1, plugins: parsed.plugins as Record<string, BridgeEntry> }
    }
  } catch {
    // 文件不存在或损坏 -> 视为空索引
  }
  return { version: 1, plugins: {} }
}

function writeBridgeIndex(pluginsRoot: string, index: BridgeIndex): void {
  mkdirSync(pluginsRoot, { recursive: true })
  writeFileSync(join(pluginsRoot, INDEX_FILE), JSON.stringify(index, null, 2) + '\n', 'utf-8')
}

function upsertBridgeEntry(pluginsRoot: string, name: string, entry: BridgeEntry): void {
  const index = readBridgeIndex(pluginsRoot)
  index.plugins[name] = entry
  writeBridgeIndex(pluginsRoot, index)
}

/** 移除索引中的对应条目（卸载插件时联动调用） */
export function removeBridgeEntry(pluginsRoot: string, name: string): void {
  const index = readBridgeIndex(pluginsRoot)
  if (index.plugins[name]) {
    delete index.plugins[name]
    writeBridgeIndex(pluginsRoot, index)
  }
}

/** 读取某插件的桥接 skills（读索引 + 解析对应 SKILL.md），供 manager 聚合层合并 */
export function loadBridgedSkills(pluginsRoot: string, pluginName: string): SkillInfo[] {
  const index = readBridgeIndex(pluginsRoot)
  const entry = index.plugins[pluginName]
  if (!entry) return []
  const skills: SkillInfo[] = []
  for (const file of entry.skillFiles ?? []) {
    const skill = parseSkillFromFile(file)
    if (skill) skills.push(skill)
  }
  return skills
}

/* ==================== 主流程：从 GitHub 安装 ==================== */

/**
 * 从 GitHub 仓库地址安装插件：
 * 1. 用 git tarball 一次性下载插件子目录到临时目录（走 codeload，不消耗 Contents API 速率限制）
 * 2. 读本地 plugin.json 拿 name
 * 3. 原子 rename 到 ~/.jeak/plugins/<name>
 * 4. 解析 skills 声明并写入 .jeak-index.json
 * 返回插件名。
 */
export async function installFromGitHub(
  url: string,
  pluginsRoot: string,
  force = false
): Promise<string> {
  const ref = parseGitHubUrl(url)
  if (!ref.subpath) {
    throw new Error('URL 未指向插件子目录，请提供形如 .../tree/main/plugins/<插件名> 的地址')
  }

  // 1. 下载到临时目录（同盘，便于原子 rename）
  mkdirSync(pluginsRoot, { recursive: true })
  const tmpDir = join(pluginsRoot, `.jeak-tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

  try {
    await downloadSubpathViaTarball(ref, ref.subpath, tmpDir)

    // 2. 读本地 plugin.json 拿 name 并解析 skills 声明
    const localManifestFile = join(tmpDir, 'plugin.json')
    if (!existsSync(localManifestFile)) {
      throw new Error('下载完成但缺少 plugin.json')
    }
    const localManifest = JSON.parse(readFileSync(localManifestFile, 'utf-8')) as PluginManifest
    const name = validatePluginName(localManifest.name)

    // 3. 冲突检查（force 时允许覆盖：下载成功后替换旧目录，失败保留旧版）
    const targetDir = join(pluginsRoot, name)
    if (existsSync(targetDir)) {
      if (!force) {
        throw new Error(`插件已安装：${name}`)
      }
      rmSync(targetDir, { recursive: true, force: true })
    }

    // 4. 原子移动到目标目录
    renameSync(tmpDir, targetDir)

    // 5. 解析 skills 声明并写入桥接索引
    upsertBridgeEntry(pluginsRoot, name, {
      source: url,
      installedAt: new Date().toISOString(),
      skillFiles: extractSkillFiles(localManifest, targetDir)
    })

    return name
  } catch (error) {
    rmSync(tmpDir, { recursive: true, force: true })
    throw error
  }
}

/* ==================== 在线市场列表（Awesome Copilot） ==================== */

const AWESOME_COPILOT = {
  owner: 'github',
  repo: 'awesome-copilot',
  ref: 'main',
  dir: 'plugins'
} as const

/** 有限并发 map，避免瞬间打满 GitHub API 配额 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workerCount = Math.min(limit, items.length)
  const workers = Array.from({ length: workerCount }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * 读取某插件目录下的 plugin.json 清单（仅取 name / description / version）。
 * 优先 raw.githubusercontent.com（download_url，不计入 API 限额），失败时回退 Contents API。
 * 两者都失败 -> 返回 null（调用方降级为「信息待完善」）。
 */
async function readPluginManifest(
  folder: string
): Promise<{ name?: string; description?: string; version?: string } | null> {
  const rawUrl =
    `https://raw.githubusercontent.com/${AWESOME_COPILOT.owner}/${AWESOME_COPILOT.repo}/` +
    `${AWESOME_COPILOT.ref}/${AWESOME_COPILOT.dir}/${encodeURIComponent(folder)}/plugin.json`
  try {
    const manifest = await fetchJson<PluginManifest>(rawUrl)
    if (manifest && typeof manifest === 'object') {
      return { name: manifest.name, description: manifest.description, version: manifest.version }
    }
    return null
  } catch {
    // raw 不可达 -> 回退 Contents API
  }

  const ref: GitHubRef = {
    owner: AWESOME_COPILOT.owner,
    repo: AWESOME_COPILOT.repo,
    ref: AWESOME_COPILOT.ref,
    subpath: ''
  }
  try {
    const buf = await fetchFileContent(ref, `${AWESOME_COPILOT.dir}/${folder}/plugin.json`)
    const manifest = JSON.parse(buf.toString('utf-8')) as PluginManifest
    if (manifest && typeof manifest === 'object') {
      return { name: manifest.name, description: manifest.description, version: manifest.version }
    }
    return null
  } catch {
    return null
  }
}

/**
 * 拉取 Awesome Copilot 在线市场的插件列表：
 * 1. 通过 Contents API 读取 plugins 目录（1 次请求，5 分钟缓存由调用方负责）
 * 2. 对每个子目录读 plugin.json（优先 raw，不计入限额），提取 name / description
 * 3. 无法读取 plugin.json 的条目降级为「信息待完善」
 */
export async function listAwesomeCopilotPlugins(): Promise<AwesomePluginInfo[]> {
  const apiUrl =
    `https://api.github.com/repos/${AWESOME_COPILOT.owner}/${AWESOME_COPILOT.repo}/contents/` +
    `${AWESOME_COPILOT.dir}?ref=${encodeURIComponent(AWESOME_COPILOT.ref)}`
  const listing = await fetchJson<GitHubItem[]>(apiUrl)
  if (!Array.isArray(listing)) throw new Error('市场列表返回格式异常')

  const dirs = listing.filter((item) => item.type === 'dir')
  return mapWithConcurrency(dirs, 5, async (dir) => {
    const folder = dir.name
    const manifest = await readPluginManifest(folder)
    const name = manifest?.name?.trim() || folder
    return {
      folder,
      name,
      description: manifest?.description?.trim() ?? '',
      version: manifest?.version?.trim() || undefined,
      pending: !manifest || !manifest.name?.trim(),
      source: 'Awesome Copilot',
      url:
        `https://github.com/${AWESOME_COPILOT.owner}/${AWESOME_COPILOT.repo}/tree/` +
        `${AWESOME_COPILOT.ref}/${AWESOME_COPILOT.dir}/${encodeURIComponent(folder)}`
    } as AwesomePluginInfo
  })
}
