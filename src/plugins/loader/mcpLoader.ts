import { readFileSync } from 'fs'
import { join } from 'path'
import type { MCPServerConfig } from '../../shared/types'

/**
 * 解析插件目录下的 mcp.json（Agent Plugins 1.0）。
 * 文件不存在时返回空对象；存在但非法时抛错（插件以 error 状态呈现）。
 */
export function loadMCPServers(dir: string): Record<string, MCPServerConfig> {
  const mcpPath = join(dir, 'mcp.json')
  let raw: string
  try {
    raw = readFileSync(mcpPath, 'utf-8')
  } catch {
    return {}
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`mcp.json 不是合法 JSON: ${msg}`)
  }

  return validateMCPServers(json)
}

/** 校验并归一化 mcp.json 的 mcpServers 结构 */
export function validateMCPServers(input: unknown): Record<string, MCPServerConfig> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('mcp.json 顶层必须是对象')
  }
  const root = input as Record<string, unknown>
  if (typeof root.mcpServers !== 'object' || root.mcpServers === null || Array.isArray(root.mcpServers)) {
    throw new Error('mcp.json 缺少 mcpServers 对象')
  }

  const servers: Record<string, MCPServerConfig> = {}
  for (const [name, value] of Object.entries(root.mcpServers as Record<string, unknown>)) {
    servers[name] = validateServerConfig(name, value)
  }
  return servers
}

function validateServerConfig(name: string, value: unknown): MCPServerConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`mcpServers.${name} 必须是对象`)
  }
  const s = value as Record<string, unknown>

  if (s.type === 'stdio') {
    if (typeof s.command !== 'string' || !s.command.trim()) {
      throw new Error(`mcpServers.${name}.command 必须是非空字符串`)
    }
    let args: string[] | undefined
    if (s.args !== undefined) {
      if (!Array.isArray(s.args) || s.args.some((a) => typeof a !== 'string')) {
        throw new Error(`mcpServers.${name}.args 必须是字符串数组`)
      }
      args = s.args as string[]
    }
    const env = s.env === undefined ? undefined : validateStringMap(s.env, `mcpServers.${name}.env`)
    let cwd: string | undefined
    if (s.cwd !== undefined) {
      if (typeof s.cwd !== 'string') throw new Error(`mcpServers.${name}.cwd 必须是字符串`)
      cwd = s.cwd
    }
    return { type: 'stdio', command: s.command, args, env, cwd }
  }

  if (s.type === 'streamable-http') {
    if (typeof s.url !== 'string' || !s.url.trim()) {
      throw new Error(`mcpServers.${name}.url 必须是非空字符串`)
    }
    const headers =
      s.headers === undefined ? undefined : validateStringMap(s.headers, `mcpServers.${name}.headers`)
    return { type: 'streamable-http', url: s.url, headers }
  }

  throw new Error(`mcpServers.${name}.type 必须是 stdio 或 streamable-http`)
}

function validateStringMap(value: unknown, field: string): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${field} 必须是对象`)
  }
  const map: Record<string, string> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== 'string') throw new Error(`${field}.${k} 必须是字符串`)
    map[k] = v
  }
  return map
}
