import { BrowserWindow, ipcMain, shell } from 'electron'
import { basename, dirname, join, resolve } from 'path'
import { existsSync, rmSync } from 'fs'
import type Store from 'electron-store'
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import type { AppSettings, EditorStateSnapshot, PluginInfo, ProjectInfo } from '../../shared/types'
import type { AIService } from '../../main/services/AIService'
import { discoverPluginDirectories } from '../loader/discovery'
import { loadPlugin, type LoadedPlugin } from '../loader/loader'
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

  async setEnabled(name: string, enabled: boolean): Promise<PluginInfo[]> {
    const info = this.infos.get(name)
    if (!info) throw new Error(`插件不存在: ${name}`)

    const store = this.deps.getSettingsStore()
    const current = store.get('plugins') ?? { disabled: [] }
    const disabled = new Set(current.disabled)
    if (enabled) disabled.delete(name)
    else disabled.add(name)
    store.set('plugins', { disabled: [...disabled] })

    if (enabled && !this.sandboxes.has(name)) {
      await this.startSandboxByInfo(info)
    } else if (!enabled && this.sandboxes.has(name)) {
      this.destroySandbox(name)
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

    // 1. 销毁沙箱
    this.destroySandbox(name)
    // 2. 从禁用列表移除
    const store = this.deps.getSettingsStore()
    const current = store.get('plugins') ?? { disabled: [] }
    store.set('plugins', { disabled: current.disabled.filter((n) => n !== name) })
    // 3. 删除目录
    rmSync(targetDir, { recursive: true, force: true })
    // 4. 移除信息
    this.infos.delete(name)

    this.broadcast()
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

  /** 应用退出时销毁所有沙箱 */
  async dispose(): Promise<void> {
    for (const name of [...this.sandboxes.keys()]) {
      this.destroySandbox(name)
    }
  }

  /* ==================== 扫描与生命周期 ==================== */

  async refresh(): Promise<void> {
    const { pluginsRoot, directories } = discoverPluginDirectories()
    this.pluginsRoot = pluginsRoot
    const disabled = this.getDisabledList()

    // 移除已不存在目录的插件
    for (const [name, info] of [...this.infos]) {
      if (!directories.includes(info.path)) {
        this.destroySandbox(name)
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
          if (enabled && !this.sandboxes.has(name)) await this.startSandbox(loaded)
          if (!enabled && this.sandboxes.has(name)) this.destroySandbox(name)
          continue
        }
        // 新插件
        const enabled = !disabled.includes(name)
        const info: PluginInfo = {
          name,
          version: loaded.manifest.version,
          description: loaded.manifest.description ?? '',
          author: loaded.manifest.author ?? '',
          license: loaded.manifest.license ?? '',
          path: dir,
          permissions: loaded.manifest.permissions,
          commands: [],
          enabled,
          status: enabled ? 'ready' : 'disabled'
        }
        this.infos.set(name, info)
        if (enabled) {
          await this.startSandbox(loaded)
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

  private async startSandboxByInfo(info: PluginInfo): Promise<void> {
    try {
      const loaded = loadPlugin(info.path)
      await this.startSandbox(loaded)
    } catch (error) {
      info.status = 'error'
      info.error = error instanceof Error ? error.message : String(error)
    }
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
