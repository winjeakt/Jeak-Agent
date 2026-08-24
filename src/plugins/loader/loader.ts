import { readFileSync } from 'fs'
import { join } from 'path'
import type { PluginCommand, PluginManifest, PluginPermission } from '../../shared/types'

export interface LoadedPlugin {
  /** 插件目录绝对路径 */
  path: string
  /** 校验通过的清单 */
  manifest: PluginManifest
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

/** 插件名：小写 kebab-case（安全：仅允许安全字符，禁止路径分隔符） */
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
/** 版本：语义化 x.y.z */
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/
/** 入口文件名：仅允许纯文件名，禁止目录穿越（.. 或 / \） */
const ENTRY_PATTERN = /^[A-Za-z0-9._-]+\.js$/

/**
 * 插件加载器：读取并严格校验 plugin.json（Agent Plugins 1.0 规范）。
 * 校验失败会抛出详细错误，插件将以 error 状态呈现，不进入沙箱。
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
  return { path: dir, manifest }
}

/** 校验清单字段，任何异常都视为不可信插件 */
export function validateManifest(input: unknown): PluginManifest {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('plugin.json 顶层必须是一个对象')
  }
  const m = input as Record<string, unknown>

  // ---- 必填字段 ----
  if (typeof m.name !== 'string' || !NAME_PATTERN.test(m.name)) {
    throw new Error('name 必须是小写 kebab-case 字符串（如 code-formatter）')
  }
  if (typeof m.version !== 'string' || !VERSION_PATTERN.test(m.version)) {
    throw new Error('version 必须是语义化版本号 x.y.z')
  }
  if (!Array.isArray(m.permissions)) {
    throw new Error('permissions 必须是数组')
  }
  const permissions = new Set<PluginPermission>()
  for (const perm of m.permissions) {
    if (typeof perm !== 'string' || !VALID_PERMISSIONS.has(perm as PluginPermission)) {
      throw new Error(`permissions 包含非法权限: ${String(perm)}`)
    }
    permissions.add(perm as PluginPermission)
  }

  // ---- 可选字段（均需类型检查） ----
  const description = optionalString(m.description, 'description')
  const author = optionalString(m.author, 'author')
  const license = optionalString(m.license, 'license')
  const $schema = optionalString(m.$schema, '$schema')

  // 入口文件：仅允许插件目录内 .js 文件，防止目录穿越读取任意文件
  let entry: string | undefined
  if (m.entry !== undefined) {
    if (typeof m.entry !== 'string' || !ENTRY_PATTERN.test(m.entry)) {
      throw new Error('entry 必须是插件目录内的 .js 文件名（禁止路径）')
    }
    entry = m.entry
  }

  // ---- 贡献点（命令） ----
  let commands: PluginCommand[] = []
  if (m.contributes !== undefined) {
    if (typeof m.contributes !== 'object' || m.contributes === null) {
      throw new Error('contributes 必须是对象')
    }
    const c = m.contributes as Record<string, unknown>
    if (c.commands !== undefined) {
      if (!Array.isArray(c.commands)) throw new Error('contributes.commands 必须是数组')
      commands = c.commands.map((cmd, index) => {
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
  }

  return {
    $schema,
    name: m.name,
    version: m.version,
    description,
    author,
    license,
    entry,
    permissions: [...permissions],
    contributes: commands.length > 0 ? { commands } : undefined
  }
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new Error(`${field} 必须是字符串`)
  return value
}
