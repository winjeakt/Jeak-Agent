import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { basename, dirname, join, resolve } from 'path'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import type Store from 'electron-store'
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import type {
  AIToolDefinition,
  AppSettings,
  EditorStateSnapshot,
  MarketPluginInfo,
  PluginInfo,
  PluginManifest,
  ProjectInfo,
  SkillInfo
} from '../../shared/types'
import type { AIService } from '../../main/services/AIService'
import { MCPClientManager } from '../../main/mcp/MCPClientManager'
import { discoverPluginDirectories } from '../loader/discovery'
import { loadPlugin, type LoadedPlugin } from '../loader/loader'
import {
  installFromGitHub as importPluginFromGitHub,
  loadBridgedSkills,
  removeBridgeEntry
} from '../marketplace/marketplace-importer'
import { PluginSandbox } from './sandbox'
import { PluginSecurityContext } from './security'
import {
  registerAiApi,
  registerEditorApi,
  registerFsApi,
  registerProjectApi,
  registerGitApi,
  registerLintApi
} from '../api'
import type { PluginApiDeps } from '../api/types'

export interface PluginManagerDeps {
  aiService: AIService
  /** 主窗口（编辑器写入转发目标） */
  getMainWindow: () => BrowserWindow | null
  /** 设置存储（保存插件禁用列表） */
  getSettingsStore: () => Store<AppSettings>
  /** 项目根目录（Phase 4 起提供；当前为空） */
  getProjectRoot?: () => string | null
}

/**
 * 插件管理器：发现 -> 加载 -> 沙箱生命周期 -> IPC 鉴权 的编排中心。
 * 插件 API 鉴权模型：
 * - 每个插件窗口创建时绑定 PluginSecurityContext（webContentsId -> 插件身份）
 * - 所有 plugin:* IPC 先校验来源身份 + 权限白名单 + 路径范围
 */
export class PluginManager {
  private sandboxes = new Map<string, PluginSandbox>()
  private infos = new Map<string, PluginInfo>()
  /** webContentsId -> 安全上下文（IPC 鉴权） */
  private securityContexts = new Map<number, PluginSecurityContext>()
  private editorState: EditorStateSnapshot | null = null
  private pluginsRoot = ''
  private ipcRegistered = false
  /** MCP servers 连接管理（mcp.json） */
  private mcp = new MCPClientManager((name) => this.getPluginDataDir(name))
  /** 已启用插件的 skills（插件名 -> skills） */
  private skills = new Map<string, SkillInfo[]>()

  constructor(private readonly deps: PluginManagerDeps) {}

  /** 初始化：注册 IPC 并扫描加载插件 */
  async init(): Promise<void> {
    if (!this.ipcRegistered) {
      this.registerCoreIpc()
      this.registerApiIpc()
      this.ipcRegistered = true
    }
    await this.refresh()
  }

  /* ==================== 对渲染进程（主窗口）的 API ==================== */

  list(): PluginInfo[] {
    return [...this.infos.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  /** 已启用插件的全部 MCP 工具（供 AI function calling 使用） */
  listMCPTools(): AIToolDefinition[] {
    return this.mcp.listTools()
  }

  /** 调用 MCP 工具（按 AI 侧工具名） */
  async callMCPTool(name: string, args: unknown): Promise<string> {
    return this.mcp.callTool(name, args)
  }

  /** 已启用插件的全部 skills（供注入 AI 上下文使用） */
  listSkills(): SkillInfo[] {
    return [...this.skills.values()].flat()
  }

  async setEnabled(name: string, enabled: boolean): Promise<PluginInfo[]> {
    const info = this.infos.get(name)
    if (!info) throw new Error(`插件不存在: ${name}`)

    const store = this.deps.getSettingsStore()
    const current = store.get('plugins') ?? { disabled: [] }
    const disabled = new Set(current.disabled)
    if (enabled) disabled.delete(name)
    else disabled.add(name)
    store.set('plugins', { disabled: [...disabled] })

    if (enabled) {
      await this.startPluginByInfo(info)
    } else {
      await this.stopPlugin(name)
    }

    await this.refreshInfo(name)
    this.broadcast()
    return this.list()
  }

  async openPluginsDir(): Promise<void> {
    await shell.openPath(this.pluginsRoot || discoverPluginDirectories().pluginsRoot)
  }

  /** 卸载插件：销毁沙箱 + 删除插件目录 + 从禁用列表移除 */
  async uninstall(name: string): Promise<PluginInfo[]> {
    const info = this.infos.get(name)
    if (!info) throw new Error(`插件不存在: ${name}`)

    // 安全校验：目录必须在 pluginsRoot 内，防止误删
    const pluginsRoot = resolve(this.pluginsRoot || discoverPluginDirectories().pluginsRoot)
    const targetDir = resolve(info.path)
    const rel = basename(targetDir)
    if (targetDir !== resolve(pluginsRoot, rel)) {
      throw new Error(`拒绝卸载：目录不在插件根目录内（${targetDir}）`)
    }

    // 1. 停止插件（沙箱 + MCP + skills）
    await this.stopPlugin(name)
    // 2. 从禁用列表移除
    const store = this.deps.getSettingsStore()
    const current = store.get('plugins') ?? { disabled: [] }
    store.set('plugins', { disabled: current.disabled.filter((n) => n !== name) })
    // 3. 删除目录
    rmSync(targetDir, { recursive: true, force: true })
    // 3.5 清理 .jeak-index.json 中的桥接条目
    removeBridgeEntry(pluginsRoot, name)
    // 4. 移除信息
    this.infos.delete(name)

    this.broadcast()
    return this.list()
  }

  /** 从本地目录安装插件：弹出目录选择对话框，复制到插件根目录并刷新 */
  async installLocal(): Promise<PluginInfo[]> {
    const pluginsRoot = resolve(this.pluginsRoot || discoverPluginDirectories().pluginsRoot)
    const win = this.deps.getMainWindow()
    const options: Electron.OpenDialogOptions = { title: '选择插件目录', properties: ['openDirectory'] }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return this.list()

    const sourceDir = result.filePaths[0]
    const targetDir = join(pluginsRoot, basename(sourceDir))
    if (resolve(sourceDir) === resolve(targetDir)) {
      throw new Error('该插件已在插件目录中')
    }
    if (!existsSync(join(sourceDir, 'plugin.json'))) {
      throw new Error('所选目录缺少 plugin.json，不是有效的插件')
    }

    mkdirSync(pluginsRoot, { recursive: true })
    cpSync(sourceDir, targetDir, { recursive: true })
    await this.refresh()
    return this.list()
  }

  /** 插件市场目录：dev 时为项目内 plugins-market/，打包后位于 asar 内 */
  private getMarketDir(): string {
    return join(app.getAppPath(), 'plugins-market')
  }

  /** 列出插件市场（plugins-market/ 内置插件），标注是否已安装 */
  listMarket(): MarketPluginInfo[] {
    const marketDir = this.getMarketDir()
    if (!existsSync(marketDir)) return []
    const installed = new Set(this.infos.keys())
    const entries = (() => {
      try {
        return readdirSync(marketDir, { withFileTypes: true })
      } catch {
        return []
      }
    })()
    const result: MarketPluginInfo[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const pluginJson = join(marketDir, entry.name, 'plugin.json')
      if (!existsSync(pluginJson)) continue
      try {
        const manifest = JSON.parse(readFileSync(pluginJson, 'utf-8')) as PluginManifest
        const authorRaw = manifest.author as string | { name?: string } | undefined
        const author = typeof authorRaw === 'string' ? authorRaw : (authorRaw?.name ?? '')
        result.push({
          name: manifest.name,
          version: manifest.version,
          description: manifest.description ?? '',
          author,
          license: manifest.license ?? '',
          installed: installed.has(manifest.name)
        })
      } catch {
        // 跳过无效插件
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name))
  }

  /** 从插件市场安装插件：复制到本地插件目录并刷新 */
  async installFromMarket(name: string): Promise<PluginInfo[]> {
    const pluginsRoot = resolve(this.pluginsRoot || discoverPluginDirectories().pluginsRoot)
    const marketDir = this.getMarketDir()
    const sourceDir = join(marketDir, name)
    if (!existsSync(join(sourceDir, 'plugin.json'))) {
      throw new Error(`市场中不存在插件: ${name}`)
    }
    const targetDir = join(pluginsRoot, name)
    if (existsSync(targetDir)) {
      throw new Error(`插件已安装: ${name}`)
    }
    mkdirSync(pluginsRoot, { recursive: true })
    cpSync(sourceDir, targetDir, { recursive: true })
    await this.refresh()
    return this.list()
  }

  /** 从 GitHub 仓库地址安装插件：下载官方插件到本地并建立 skills 桥接索引 */
  async installFromGithub(url: string): Promise<PluginInfo[]> {
    const pluginsRoot = resolve(this.pluginsRoot || discoverPluginDirectories().pluginsRoot)
    await importPluginFromGitHub(String(url), pluginsRoot)
    await this.refresh()
    return this.list()
  }

  /** 创建新插件模板（plugin.json + index.js） */
  async create(name: string): Promise<PluginInfo[]> {
    const pluginsRoot = resolve(this.pluginsRoot || discoverPluginDirectories().pluginsRoot)
    const safeName = String(name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
    if (!safeName) throw new Error('插件名不能为空')
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(safeName)) {
      throw new Error('插件名只能包含小写字母、数字和连字符')
    }

    const targetDir = join(pluginsRoot, safeName)
    if (existsSync(targetDir)) throw new Error(`插件目录已存在: ${safeName}`)

    mkdirSync(targetDir, { recursive: true })
    writeFileSync(
      join(targetDir, 'plugin.json'),
      JSON.stringify(
        {
          name: safeName,
          version: '0.1.0',
          description: '我的新插件',
          author: '',
          license: 'MIT',
          permissions: [],
          entry: 'index.js'
        },
        null,
        2
      ) + '\n',
      'utf-8'
    )
    writeFileSync(
      join(targetDir, 'index.js'),
      [
        '// 插件入口文件',
        '// 通过全局 jeak API 与 Jeak Agent 交互（如 jeak.ai.chat、jeak.fs.read 等）',
        '// 完整 API 文档：https://github.com/winjeakt/Jeak-Agent',
        '',
        "console.log('插件已加载')",
        ''
      ].join('\n'),
      'utf-8'
    )
    await this.refresh()
    return this.list()
  }

  runCommand(command: string): void {
    for (const sandbox of this.sandboxes.values()) {
      if (sandbox.commands.some((c) => c.command === command)) {
        sandbox.runCommand(command)
        return
      }
    }
    throw new Error(`命令 ${command} 未由任何已启用插件注册`)
  }

  /** 应用退出时销毁所有沙箱与 MCP 连接 */
  async dispose(): Promise<void> {
    for (const name of [...this.sandboxes.keys()]) {
      this.destroySandbox(name)
    }
    this.skills.clear()
    await this.mcp.dispose()
  }

  /* ==================== 扫描与生命周期 ==================== */

  async refresh(): Promise<void> {
    const { pluginsRoot, directories } = discoverPluginDirectories()
    this.pluginsRoot = pluginsRoot
    const disabled = this.getDisabledList()

    // 移除已不存在目录的插件
    for (const [name, info] of [...this.infos]) {
      if (!directories.includes(info.path)) {
        await this.stopPlugin(name)
        this.infos.delete(name)
      }
    }

    const seen = new Set<string>()
    for (const dir of directories) {
      const dirName = basename(dir)
      try {
        const loaded = loadPlugin(dir)
        const name = loaded.manifest.name
        seen.add(name)
        if (this.infos.has(name) && this.infos.get(name)?.path === dir) {
          // 已加载，仅保证启停状态一致
          const enabled = !disabled.includes(name)
          const info = this.infos.get(name)
          if (info) {
            info.enabled = enabled
            info.status = enabled && this.sandboxes.has(name) ? 'ready' : enabled ? 'error' : 'disabled'
            if (info.status === 'error' && this.sandboxes.has(name)) info.status = 'ready'
          }
          if (enabled) await this.startPlugin(loaded)
          else await this.stopPlugin(name)
          continue
        }
        // 新插件
        const enabled = !disabled.includes(name)
        const info: PluginInfo = {
          name,
          version: loaded.manifest.version,
          description: loaded.manifest.description ?? '',
          author: loaded.manifest.author?.name ?? '',
          license: loaded.manifest.license ?? '',
          path: dir,
          permissions: loaded.manifest.permissions,
          commands: [],
          enabled,
          status: enabled ? 'ready' : 'disabled'
        }
        this.infos.set(name, info)
        if (enabled) {
          await this.startPlugin(loaded)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const name = this.infos.get(dirName)?.name ?? dirName
        const existing = this.infos.get(name)
        this.infos.set(name, {
          name,
          version: existing?.version ?? '0.0.0',
          description: existing?.description ?? '',
          author: existing?.author ?? '',
          license: existing?.license ?? '',
          path: dir,
          permissions: existing?.permissions ?? [],
          commands: [],
          enabled: false,
          status: 'error',
          error: message
        })
      }
    }
    this.broadcast()
  }

  private async startPluginByInfo(info: PluginInfo): Promise<void> {
    try {
      const loaded = loadPlugin(info.path)
      await this.startPlugin(loaded)
    } catch (error) {
      info.status = 'error'
      info.error = error instanceof Error ? error.message : String(error)
    }
  }

  /** 启动一个插件：命令型沙箱 + MCP servers + skills（纯声明型插件只连 MCP/加载 skills） */
  private async startPlugin(loaded: LoadedPlugin): Promise<void> {
    const name = loaded.manifest.name
    if (loaded.manifest.entry) {
      await this.startSandbox(loaded)
    }
    if (Object.keys(loaded.mcpServers).length > 0) {
      await this.mcp.connectPlugin(name, loaded.path, loaded.mcpServers)
    }
    // 合并约定式扫描的 skills 与官方 extensions.*.skills 桥接的 skills（按 path 去重）
    const bridged = this.pluginsRoot ? loadBridgedSkills(this.pluginsRoot, name) : []
    const skills = this.dedupeSkills([...loaded.skills, ...bridged])
    if (skills.length > 0) {
      this.skills.set(name, skills)
    }
    const info = this.infos.get(name)
    if (info && !loaded.manifest.entry) {
      info.status = 'ready'
      info.error = undefined
    }
  }

  /** 按 skill 目录路径去重（约定式与桥接可能指向同一目录） */
  private dedupeSkills(skills: SkillInfo[]): SkillInfo[] {
    const seen = new Set<string>()
    const result: SkillInfo[] = []
    for (const skill of skills) {
      if (seen.has(skill.path)) continue
      seen.add(skill.path)
      result.push(skill)
    }
    return result
  }

  /** 停止一个插件：销毁沙箱 + 断开 MCP + 移除 skills */
  private async stopPlugin(name: string): Promise<void> {
    this.destroySandbox(name)
    await this.mcp.disconnectPlugin(name)
    this.skills.delete(name)
  }

  /** 插件数据目录（PLUGIN_DATA） */
  private getPluginDataDir(name: string): string {
    return join(app.getPath('userData'), 'plugin-data', name)
  }

  private async startSandbox(loaded: LoadedPlugin): Promise<void> {
    const name = loaded.manifest.name
    if (this.sandboxes.has(name)) return

    const sandbox = new PluginSandbox(loaded, {
      onCreated: (webContentsId) => {
        const ctx = new PluginSecurityContext(name, loaded.path, loaded.manifest, [loaded.path])
        this.securityContexts.set(webContentsId, ctx)
        // Phase 4 打开项目后可追加项目根: ctx.addAllowRoot(projectRoot)
      },
      onCommandRegistered: (_pluginName, commands) => {
        const info = this.infos.get(name)
        if (info) {
          info.commands = commands
          this.broadcast()
        }
      },
      onLog: (pluginName, level, message) => {
        console.log(`[plugin:${pluginName}] (${level}) ${message}`)
      },
      onError: (pluginName, message) => {
        const info = this.infos.get(pluginName)
        if (info) {
          info.status = 'error'
          info.error = message
          this.broadcast()
        }
      }
    })

    // 关键：先注册沙箱再启动。插件窗口创建后立即执行入口脚本，
    // 脚本会通过 IPC（registerCommand / log）回调主进程，此时必须能定位到沙箱，
    // 否则 start() 期间会抛"沙箱不存在"。启动失败再回滚。
    this.sandboxes.set(name, sandbox)
    try {
      await sandbox.start()
      const info = this.infos.get(name)
      if (info) {
        info.status = 'ready'
        info.error = undefined
        info.commands = sandbox.commands
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[plugins] 启动插件 ${name} 失败: ${message}`)
      this.sandboxes.delete(name)
      sandbox.destroy()
      // 清理可能已绑定的上下文
      for (const [id, ctx] of this.securityContexts) {
        if (ctx.pluginName === name) this.securityContexts.delete(id)
      }
      const info = this.infos.get(name)
      if (info) {
        info.status = 'error'
        info.error = message
      }
    }
  }

  private destroySandbox(name: string): void {
    const sandbox = this.sandboxes.get(name)
    if (sandbox) {
      const id = sandbox.webContentsId
      if (id !== null) this.securityContexts.delete(id)
      sandbox.destroy()
      this.sandboxes.delete(name)
    }
  }

  private async refreshInfo(name: string): Promise<void> {
    const info = this.infos.get(name)
    if (!info) return
    const sandbox = this.sandboxes.get(name)
    info.enabled = sandbox !== undefined || !this.getDisabledList().includes(name)
    if (sandbox) {
      info.status = 'ready'
      info.error = undefined
      info.commands = sandbox.commands
    } else if (info.enabled) {
      info.status = 'error'
    } else {
      info.status = 'disabled'
    }
  }

  /* ==================== IPC 注册 ==================== */

  private registerCoreIpc(): void {
    ipcMain.handle('plugins:list', () => this.list())
    ipcMain.handle('plugins:toggle', async (_e, name: string, enabled: boolean) => {
      return this.setEnabled(String(name), Boolean(enabled))
    })
    ipcMain.handle('plugins:open-dir', async () => {
      await this.openPluginsDir()
      return { ok: true }
    })
    ipcMain.handle('plugins:run-command', (_e, command: string) => {
      this.runCommand(String(command))
      return { ok: true }
    })
    ipcMain.handle('plugins:uninstall', async (_e, name: string) => {
      return this.uninstall(String(name))
    })
    ipcMain.handle('plugins:install-local', async () => {
      return this.installLocal()
    })
    ipcMain.handle('plugins:create', async (_e, name: string) => {
      return this.create(String(name))
    })
    ipcMain.handle('plugins:market:list', () => this.listMarket())
    ipcMain.handle('plugins:market:install', async (_e, name: string) => {
      return this.installFromMarket(String(name))
    })
    ipcMain.handle('plugins:install-github', async (_e, url: string) => {
      return this.installFromGithub(String(url))
    })

    // 编辑器状态镜像：主窗口渲染进程实时同步（供插件 editor API 读取）
    ipcMain.on('editor:sync', (_event, state: EditorStateSnapshot) => {
      this.editorState = state
    })

    // 插件窗口 -> 主进程：命令注册（来源必须为受信任插件窗口）
    ipcMain.on('plugin:command:register', (event, payload: { command?: string; title?: string }) => {
      const sandbox = this.getSandboxBySender(event)
      if (typeof payload?.command !== 'string' || typeof payload?.title !== 'string') {
        throw new Error('无效的命令注册')
      }
      sandbox.registerCommand(payload.command, payload.title)
    })

    // 插件窗口 -> 主进程：日志
    ipcMain.on('plugin:log', (event, payload: { level?: string; message?: string }) => {
      const sandbox = this.getSandboxBySender(event)
      const level = typeof payload?.level === 'string' ? payload.level : 'info'
      const message = typeof payload?.message === 'string' ? payload.message : String(payload)
      sandbox.log(level, message)
    })
  }

  private registerApiIpc(): void {
    const deps: PluginApiDeps = {
      getContext: (event: IpcMainEvent | IpcMainInvokeEvent) => this.getContextBySender(event),
      aiService: this.deps.aiService,
      getMainWindow: this.deps.getMainWindow,
      getEditorState: () => this.editorState,
      getProjectInfo: (): ProjectInfo => ({
        root: this.getProjectRoot(),
        openFiles: this.editorState?.path ? [this.editorState.path] : []
      }),
      getProjectRoot: () => this.getProjectRoot()
    }
    registerAiApi(deps)
    registerFsApi(deps)
    registerEditorApi(deps)
    registerProjectApi(deps)
    registerGitApi(deps)
    registerLintApi(deps)
  }

  /**
   * 推导当前项目根目录：
   * 1. 外部注入的 getProjectRoot（若提供）
   * 2. 从编辑器当前文件路径向上查找 .git 目录
   * 3. 找不到则返回编辑器文件所在目录（或 null）
   */
  private getProjectRoot(): string | null {
    const injected = this.deps.getProjectRoot?.()
    if (injected) return injected

    const filePath = this.editorState?.path
    if (!filePath) return null

    // 向上查找 .git
    let dir = dirname(filePath)
    for (let i = 0; i < 20; i++) {
      if (existsSync(join(dir, '.git'))) return dir
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    return dirname(filePath)
  }

  private getContextBySender(event: IpcMainEvent | IpcMainInvokeEvent): PluginSecurityContext {
    const ctx = this.securityContexts.get(event.sender.id)
    if (!ctx) {
      throw new Error('拒绝访问：IPC 来源不是受信任的插件沙箱窗口')
    }
    return ctx
  }

  private getSandboxBySender(event: IpcMainEvent | IpcMainInvokeEvent): PluginSandbox {
    const ctx = this.getContextBySender(event)
    const sandbox = this.sandboxes.get(ctx.pluginName)
    if (!sandbox) {
      throw new Error(`插件 ${ctx.pluginName} 沙箱不存在`)
    }
    return sandbox
  }

  private getDisabledList(): string[] {
    return this.deps.getSettingsStore().get('plugins')?.disabled ?? []
  }

  /** 通知主窗口渲染进程：插件列表/状态发生变化 */
  private broadcast(): void {
    const win = this.deps.getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('plugins:changed', this.list())
    }
  }
}
