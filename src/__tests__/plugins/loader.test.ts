import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { loadPlugin, validateManifest } from '../../plugins/loader/loader'

describe('validateManifest', () => {
  it('接受最小合法清单', () => {
    const m = validateManifest({ name: 'my-plugin', version: '1.0.0' })
    expect(m.name).toBe('my-plugin')
    expect(m.version).toBe('1.0.0')
    expect(m.permissions).toEqual([])
    expect(m.contributes).toBeUndefined()
    expect(m.entry).toBeUndefined()
  })

  it('顶层非对象时抛错', () => {
    for (const bad of [null, [], 'str', 42]) {
      expect(() => validateManifest(bad)).toThrow('顶层必须是一个对象')
    }
  })

  it('name 非法时抛错', () => {
    for (const name of ['Foo', 'my plugin', 'a..b', 'a--b', '']) {
      expect(() => validateManifest({ name, version: '1.0.0' })).toThrow('name')
    }
  })

  it('version 非法时抛错', () => {
    expect(() => validateManifest({ name: 'ok', version: '1.0' })).toThrow('version')
  })

  it('entry 路径穿越时抛错', () => {
    const m = { name: 'ok', version: '1.0.0', extensions: { 'dev.jeak-agent': { entry: '../evil.js' } } }
    expect(() => validateManifest(m)).toThrow('entry')
  })

  it('permissions 非法时抛错', () => {
    const m = { name: 'ok', version: '1.0.0', extensions: { 'dev.jeak-agent': { permissions: ['nope'] } } }
    expect(() => validateManifest(m)).toThrow('非法权限')
  })

  it('author 字符串转对象', () => {
    const m = validateManifest({ name: 'ok', version: '1.0.0', author: 'Alice' })
    expect(m.author).toEqual({ name: 'Alice' })
  })

  it('author 对象解析', () => {
    const m = validateManifest({ name: 'ok', version: '1.0.0', author: { name: 'A', email: 'a@b.c' } })
    expect(m.author).toEqual({ name: 'A', email: 'a@b.c' })
  })

  it('author 非法抛错', () => {
    expect(() => validateManifest({ name: 'ok', version: '1.0.0', author: 42 })).toThrow('author')
  })

  it('extensions 合并 entry 与 permissions', () => {
    const m = validateManifest({
      name: 'ok',
      version: '1.0.0',
      extensions: { 'dev.jeak-agent': { entry: 'index.js', permissions: ['ai:chat', 'fs:read'] } }
    })
    expect(m.entry).toBe('index.js')
    expect(m.permissions).toEqual(['ai:chat', 'fs:read'])
  })

  it('extensions 非对象抛错', () => {
    const m = { name: 'ok', version: '1.0.0', extensions: { 'dev.jeak-agent': 'bad' } }
    expect(() => validateManifest(m)).toThrow('必须是对象')
  })

  it('contributes.commands 解析', () => {
    const m = validateManifest({
      name: 'ok',
      version: '1.0.0',
      extensions: { 'dev.jeak-agent': { contributes: { commands: [{ command: 'x', title: 'X' }] } } }
    })
    expect(m.contributes).toEqual({ commands: [{ command: 'x', title: 'X' }] })
  })

  it('contributes.commands 缺 title 抛错', () => {
    const m = {
      name: 'ok',
      version: '1.0.0',
      extensions: { 'dev.jeak-agent': { contributes: { commands: [{ command: 'x' }] } } }
    }
    expect(() => validateManifest(m)).toThrow('title')
  })
})

describe('loadPlugin', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'jeak-loader-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('加载含 manifest/skills/mcp 的完整插件', () => {
    mkdirSync(join(dir, 'skills', 'greet'), { recursive: true })
    writeFileSync(join(dir, 'plugin.json'), JSON.stringify({ name: 'demo', version: '1.0.0' }))
    writeFileSync(join(dir, 'mcp.json'), JSON.stringify({ mcpServers: { demo: { type: 'stdio', command: 'node' } } }))
    writeFileSync(join(dir, 'skills', 'greet', 'SKILL.md'), '---\nname: greet\n---\nhello')

    const loaded = loadPlugin(dir)
    expect(loaded.manifest.name).toBe('demo')
    expect(Object.keys(loaded.mcpServers)).toEqual(['demo'])
    expect(loaded.skills).toHaveLength(1)
    expect(loaded.skills[0].name).toBe('greet')
    expect(loaded.skills[0].body).toBe('hello')
  })

  it('缺少 plugin.json 抛错', () => {
    expect(() => loadPlugin(dir)).toThrow('无法读取插件清单')
  })

  it('plugin.json 非法 JSON 抛错', () => {
    writeFileSync(join(dir, 'plugin.json'), '{bad')
    expect(() => loadPlugin(dir)).toThrow('不是合法 JSON')
  })
})
