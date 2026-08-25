import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  installFromGitHub,
  listAwesomeCopilotPlugins,
  loadBridgedSkills,
  parseGitHubUrl,
  readBridgeIndex,
  removeBridgeEntry
} from '../../plugins/marketplace/marketplace-importer'

describe('parseGitHubUrl', () => {
  it('解析标准 tree 地址', () => {
    expect(parseGitHubUrl('https://github.com/owner/repo/tree/main/plugins/demo')).toEqual({
      owner: 'owner',
      repo: 'repo',
      ref: 'main',
      subpath: 'plugins/demo'
    })
  })

  it('解析根地址（subpath 为空）', () => {
    expect(parseGitHubUrl('https://github.com/owner/repo')).toEqual({
      owner: 'owner',
      repo: 'repo',
      ref: 'main',
      subpath: ''
    })
  })

  it('去除 .git 后缀', () => {
    expect(parseGitHubUrl('https://github.com/owner/repo.git/tree/dev/plugins/x').repo).toBe('repo')
  })

  it('非法地址抛错', () => {
    expect(() => parseGitHubUrl('https://gitlab.com/owner/repo')).toThrow('无法解析')
  })
})

describe('installFromGitHub', () => {
  let pluginsRoot: string
  let fixture: string

  beforeEach(() => {
    pluginsRoot = mkdtempSync(join(tmpdir(), 'jeak-plugins-'))
    fixture = mkdtempSync(join(tmpdir(), 'jeak-fixture-'))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    rmSync(pluginsRoot, { recursive: true, force: true })
    rmSync(fixture, { recursive: true, force: true })
  })

  function makeRepo(pluginName: string, withPluginJson = true): void {
    const demoDir = join(fixture, 'repo-main', 'plugins', 'demo')
    mkdirSync(join(demoDir, 'skills', 'greet'), { recursive: true })
    if (withPluginJson) {
      writeFileSync(
        join(demoDir, 'plugin.json'),
        JSON.stringify({
          name: pluginName,
          version: '1.0.0',
          extensions: { 'dev.jeak-agent': { skills: ['skills/greet'] } }
        })
      )
    }
    writeFileSync(join(demoDir, 'skills', 'greet', 'SKILL.md'), '---\nname: greet\n---\nhi')
  }

  function packTarball(): Buffer {
    const tarPath = join(fixture, 'repo.tar.gz')
    execFileSync('tar', ['-czf', tarPath, '-C', fixture, 'repo-main'])
    return readFileSync(tarPath)
  }

  function mockTarballFetch(buf: Buffer): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown) => {
        if (String(url).includes('codeload')) return new Response(buf, { status: 200 })
        return new Response('', { status: 404 })
      })
    )
  }

  it('成功下载并桥接', async () => {
    makeRepo('demo')
    mockTarballFetch(packTarball())
    const name = await installFromGitHub(
      'https://github.com/owner/repo/tree/main/plugins/demo',
      pluginsRoot
    )
    expect(name).toBe('demo')
    expect(existsSync(join(pluginsRoot, 'demo', 'plugin.json'))).toBe(true)
    const index = readBridgeIndex(pluginsRoot)
    expect(index.plugins.demo.source).toBe('https://github.com/owner/repo/tree/main/plugins/demo')
    expect(index.plugins.demo.skillFiles).toHaveLength(1)
  })

  it('URL 未指向子目录抛错', async () => {
    await expect(installFromGitHub('https://github.com/owner/repo', pluginsRoot)).rejects.toThrow(
      '未指向插件子目录'
    )
  })

  it('缺少 plugin.json 抛错', async () => {
    makeRepo('demo', false)
    mockTarballFetch(packTarball())
    await expect(
      installFromGitHub('https://github.com/owner/repo/tree/main/plugins/demo', pluginsRoot)
    ).rejects.toThrow('缺少 plugin.json')
  })

  it('已安装且不 force 抛错', async () => {
    makeRepo('demo')
    const buf = packTarball()
    mockTarballFetch(buf)
    await installFromGitHub('https://github.com/owner/repo/tree/main/plugins/demo', pluginsRoot)
    mockTarballFetch(buf)
    await expect(
      installFromGitHub('https://github.com/owner/repo/tree/main/plugins/demo', pluginsRoot)
    ).rejects.toThrow('已安装')
  })

  it('force 覆盖旧目录', async () => {
    makeRepo('demo')
    const buf = packTarball()
    mockTarballFetch(buf)
    await installFromGitHub('https://github.com/owner/repo/tree/main/plugins/demo', pluginsRoot)
    mockTarballFetch(buf)
    await expect(
      installFromGitHub('https://github.com/owner/repo/tree/main/plugins/demo', pluginsRoot, true)
    ).resolves.toBe('demo')
  })

  it('下载失败清理临时目录', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })))
    await expect(
      installFromGitHub('https://github.com/owner/repo/tree/main/plugins/demo', pluginsRoot)
    ).rejects.toThrow('tarball')
    expect(readdirSync(pluginsRoot)).toEqual([])
  })
})

describe('listAwesomeCopilotPlugins', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('解析目录并降级无法读取的插件', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown) => {
        const u = String(url)
        if (u.includes('/contents/plugins')) {
          return new Response(
            JSON.stringify([
              { type: 'dir', name: 'foo', path: 'plugins/foo' },
              { type: 'dir', name: 'bar', path: 'plugins/bar' }
            ]),
            { status: 200 }
          )
        }
        if (u.includes('raw.githubusercontent.com') && u.endsWith('/foo/plugin.json')) {
          return new Response(
            JSON.stringify({ name: 'Foo Plugin', description: 'Desc', version: '1.0.0' }),
            { status: 200 }
          )
        }
        return new Response('', { status: 404 })
      })
    )

    const list = await listAwesomeCopilotPlugins()
    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({ folder: 'foo', name: 'Foo Plugin', description: 'Desc', version: '1.0.0', pending: false })
    expect(list[1]).toMatchObject({ folder: 'bar', name: 'bar', description: '', pending: true })
  })

  it('响应非数组抛错', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })))
    await expect(listAwesomeCopilotPlugins()).rejects.toThrow('格式异常')
  })
})

describe('bridge index', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'jeak-bridge-'))
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('readBridgeIndex 不存在返回空', () => {
    expect(readBridgeIndex(root)).toEqual({ version: 1, plugins: {} })
  })

  it('readBridgeIndex 损坏 JSON 返回空', () => {
    writeFileSync(join(root, '.jeak-index.json'), '{bad')
    expect(readBridgeIndex(root)).toEqual({ version: 1, plugins: {} })
  })

  it('removeBridgeEntry 删除条目', () => {
    writeFileSync(
      join(root, '.jeak-index.json'),
      JSON.stringify({ version: 1, plugins: { demo: { source: 'x', installedAt: 't', skillFiles: [] } } })
    )
    removeBridgeEntry(root, 'demo')
    expect(readBridgeIndex(root).plugins).toEqual({})
  })

  it('loadBridgedSkills 解析 skill 文件', () => {
    const skillDir = join(root, 'demo', 'skills', 'greet')
    mkdirSync(skillDir, { recursive: true })
    const skillFile = join(skillDir, 'SKILL.md')
    writeFileSync(skillFile, '---\nname: greet\n---\nhi')
    writeFileSync(
      join(root, '.jeak-index.json'),
      JSON.stringify({ version: 1, plugins: { demo: { source: 'x', installedAt: 't', skillFiles: [skillFile] } } })
    )
    const skills = loadBridgedSkills(root, 'demo')
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('greet')
  })
})
