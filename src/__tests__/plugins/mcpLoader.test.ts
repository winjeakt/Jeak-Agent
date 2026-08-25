import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { loadMCPServers, validateMCPServers } from '../../plugins/loader/mcpLoader'

describe('loadMCPServers', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'jeak-mcp-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('文件不存在返回空对象', () => {
    expect(loadMCPServers(dir)).toEqual({})
  })

  it('非法 JSON 抛错', () => {
    writeFileSync(join(dir, 'mcp.json'), '{bad')
    expect(() => loadMCPServers(dir)).toThrow('不是合法 JSON')
  })

  it('解析 stdio 与 streamable-http', () => {
    writeFileSync(
      join(dir, 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          stdio: { type: 'stdio', command: 'node', args: ['a.js'], env: { K: 'V' }, cwd: '/x' },
          http: { type: 'streamable-http', url: 'http://localhost:3000', headers: { A: 'b' } }
        }
      })
    )
    const servers = loadMCPServers(dir)
    expect(servers.stdio).toEqual({ type: 'stdio', command: 'node', args: ['a.js'], env: { K: 'V' }, cwd: '/x' })
    expect(servers.http).toEqual({ type: 'streamable-http', url: 'http://localhost:3000', headers: { A: 'b' } })
  })
})

describe('validateMCPServers', () => {
  it('顶层非对象抛错', () => {
    expect(() => validateMCPServers([])).toThrow('顶层必须是对象')
  })

  it('缺少 mcpServers 抛错', () => {
    expect(() => validateMCPServers({})).toThrow('mcpServers')
  })

  it('stdio 缺 command 抛错', () => {
    expect(() => validateMCPServers({ mcpServers: { s: { type: 'stdio' } } })).toThrow('command')
  })

  it('stdio args 非字符串数组抛错', () => {
    expect(() => validateMCPServers({ mcpServers: { s: { type: 'stdio', command: 'node', args: [1] } } })).toThrow(
      'args'
    )
  })

  it('streamable-http 缺 url 抛错', () => {
    expect(() => validateMCPServers({ mcpServers: { s: { type: 'streamable-http' } } })).toThrow('url')
  })

  it('未知 type 抛错', () => {
    expect(() => validateMCPServers({ mcpServers: { s: { type: 'sse' } } })).toThrow('stdio 或 streamable-http')
  })
})
