import { readFileSync } from 'fs'
import { join } from 'path'
import type {
  MCPServerConfig,
  PluginAuthor,
  PluginCommand,
  PluginManifest,
  PluginPermission,
  SkillInfo
} from '../../shared/types'
import { loadMCPServers } from './mcpLoader'
import { loadSkills } from './skillsLoader'

export interface LoadedPlugin {
  /** 插件目录绝对路径 */
  path: string
  /** 校验通过的清单（plugin.json） */
  manifest: PluginManifest
  /** 解析后的 MCP servers（mcp.json，无则空对象） */
  mcpServers: Record<string, MCPServerConfig>
  /** 发现的 skills（skills/{name}/SKILL.md） */
  skills: SkillInfo[]
}

/** 合法的权限集合（未在清单中申请 -> 加载失败，防止越权） */
const VALID_PERMISSIONS = new Set<PluginPermission>([
  'ai:chat',
  'ai:stream',
  'fs:read',
  'fs:write',
  'editor:get',
  'editor:apply',
  'project:get',
  'git:diff',
  'git:status',
  'git:run',
  'lint:run'
])

/** Jeak-Agent 客户端扩展命名空间 */
const JEK_EXTENSION = 'dev.jeak-agent'

/** 插件名：官方规则（1-64 字符，小写字母/数字/点/连字符，首尾字母数字，禁 .. 与 --） */
const NAME_PATTERN = /^(?!.*\.\.)(?!.*--)[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/
/** 版本：语义化 x.y.z */
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/
/** 入口文件名：仅允许纯文件名，禁止目录穿越（.. 或 / \） */
const ENTRY_PATTERN = /^[A-Za-z0-9._-]+\.js$/

/**
 * 插件加载器：读取并校验 plugin.json（Agent Plugins 1.0 规范），
 * 同时解析 mcp.json 与 skills/ 目录。校验失败抛出详细错误。
 */
export function loadPlugin(dir: string): LoadedPlugin {
  const manifestPath = join(dir, 'plugin.json')
  let raw: string
  try {
    raw = readFileSync(manifestPath, 'utf-8')
  } catch {
    throw new Error(`无法读取插件清单: ${manifestPath}`)
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`plugin.json 不是合法 JSON（${manifestPath}）: ${msg}`)
  }

  const manifest = validateManifest(json)
  return { path: dir, manifest, mcpServers: loadMCPServers(dir), skills: loadSkills(dir) }
}

/** 校验清单字段，任何异常都视为不可信插件 */
export function validateManifest(input: unknown): PluginManifest {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('plugin.json 顶层必须是一个对象')
  }
  const m = input as Record<string, unknown>

  if (typeof m.name !== 'string' || !NAME_PATTERN.test(m.name)) {
    throw new Error('name 必须是 1-64 字符的小写字母/数字/点/连字符（首尾字母数字，禁 .. 与 --）')
  }
  if (typeof m.version !== 'string' || !VERSION_PATTERN.test(m.version)) {
    throw new Error('version 必须是语义化版本号 x.y.z')
  }

  const $schema = optionalString(m.$schema, '$schema')
  const description = optionalString(m.description, 'description')
  const author = optionalAuthor(m.author)
  const homepage = optionalString(m.homepage, 'homepage')
  const repository = optionalString(m.repository, 'repository')
  const license = optionalString(m.license, 'license')
  const keywords = optionalStringArray(m.keywords, 'keywords')
  const extensions = optionalRecord(m.extensions, 'extensions')

  // Jeak 命令型扩展字段：优先 extensions[dev.jeak-agent]，兼容旧版顶层字段
  const jeak = resolveJeakExtension(m, extensions)

  let entry: string | undefined
  if (jeak.entry !== undefined) {
    if (typeof jeak.entry !== 'string' || !ENTRY_PATTERN.test(jeak.entry)) {
      throw new Error('entry 必须是插件目录内的 .js 文件名（禁止路径）')
    }
    entry = jeak.entry
  }

  const permissions = resolvePermissions(jeak.permissions)
  const commands = resolveCommands(jeak.contributes)

  return {
    $schema,
    name: m.name,
    version: m.version,
    description,
    author,
    homepage,
    repository,
    license,
    keywords,
    extensions,
    entry,
    permissions,
    contributes: commands.length > 0 ? { commands } : undefined
  }
}

function resolveJeakExtension(
  m: Record<string, unknown>,
  extensions: Record<string, unknown> | undefined
): Record<string, unknown> {
  const jeak = extensions?.[JEK_EXTENSION]
  if (jeak === undefined) return m
  if (typeof jeak !== 'object' || jeak === null || Array.isArray(jeak)) {
    throw new Error(`extensions.${JEK_EXTENSION} 必须是对象`)
  }
  return { ...m, ...(jeak as Record<string, unknown>) }
}

function resolvePermissions(value: unknown): PluginPermission[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('permissions 必须是数组')
  const permissions = new Set<PluginPermission>()
  for (const perm of value) {
    if (typeof perm !== 'string' || !VALID_PERMISSIONS.has(perm as PluginPermission)) {
      throw new Error(`permissions 包含非法权限: ${String(perm)}`)
    }
    permissions.add(perm as PluginPermission)
  }
  return [...permissions]
}

function resolveCommands(value: unknown): PluginCommand[] {
  if (value === undefined) return []
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('contributes 必须是对象')
  }
  const c = value as Record<string, unknown>
  if (c.commands === undefined) return []
  if (!Array.isArray(c.commands)) throw new Error('contributes.commands 必须是数组')
  return c.commands.map((cmd, index) => {
    if (typeof cmd !== 'object' || cmd === null) {
      throw new Error(`contributes.commands[${index}] 必须是对象`)
    }
    const cc = cmd as Record<string, unknown>
    if (typeof cc.command !== 'string' || !cc.command.trim()) {
      throw new Error(`contributes.commands[${index}].command 必须是非空字符串`)
    }
    if (typeof cc.title !== 'string' || !cc.title.trim()) {
      throw new Error(`contributes.commands[${index}].title 必须是非空字符串`)
    }
    return { command: cc.command, title: cc.title }
  })
}

function optionalAuthor(value: unknown): PluginAuthor | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'string') return { name: value }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const a = value as Record<string, unknown>
    const author: PluginAuthor = {}
    if (typeof a.name === 'string') author.name = a.name
    if (typeof a.email === 'string') author.email = a.email
    if (typeof a.url === 'string') author.url = a.url
    return author
  }
  throw new Error('author 必须是字符串或对象')
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new Error(`${field} 必须是字符串`)
  return value
}

function optionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new Error(`${field} 必须是字符串数组`)
  }
  return value as string[]
}

function optionalRecord(value: unknown, field: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${field} 必须是对象`)
  }
  return value as Record<string, unknown>
}
