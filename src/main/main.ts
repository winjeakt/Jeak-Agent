import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { rmSync } from 'fs'
import { hostname } from 'os'
import Store from 'electron-store'
import type {
  AIChatModel,
  AIChatRequest,
  AppLanguage,
  AppSettings,
  Theme
} from '../shared/types'
import { DEFAULT_SHORTCUTS, DEFAULT_LAYOUT } from '../shared/types'
import { AIService } from './services/AIService'
import { PluginManager } from '../plugins/runtime/manager'
import { TerminalService, registerTerminalIpc } from './services/TerminalService'
import { registerWindowControls } from './windowControls'
import { registerMenuIpc } from './menuIpc'
import { createTray, destroyTray } from './tray'
import { createAppIcon } from './icon'

/* ==================== 全局错误处理 ==================== */

process.on('uncaughtException', (error) => {
  console.error('[main] 未捕获异常:', error)
  // 尝试通知渲染进程展示错误（若窗口存在）
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:fatal-error', error?.message ?? String(error))
  }
})

process.on('unhandledRejection', (reason) => {
  console.error('[main] 未处理的 Promise 拒绝:', reason)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(
      'app:fatal-error',
      reason instanceof Error ? reason.message : String(reason)
    )
  }
})

/* ==================== 设置存储（electron-store 加密） ==================== */

const DEFAULT_AI_SETTINGS = {
  apiKey: '',
  model: 'deepseek-chat' as AIChatModel,
  temperature: 0.7,
  maxTokens: 4096
}

/** 基于机器信息派生加密密钥 */
function getSystemFingerprint(): string {
  return `jeak-agent-${hostname()}`
}

function createStore(): Store<AppSettings> {
  const options = {
    name: 'jeak-agent-settings',
    encryptionKey: getSystemFingerprint(),
    defaults: {
      theme: 'dark' as Theme,
      language: 'zh' as AppLanguage,
      ai: DEFAULT_AI_SETTINGS,
      plugins: { disabled: [] as string[] },
      onboarded: false,
      shortcuts: DEFAULT_SHORTCUTS,
      layout: DEFAULT_LAYOUT,
      recentProjects: [] as string[],
      autoSave: false
    }
  }
  try {
    return new Store<AppSettings>(options)
  } catch (error) {
    // 兼容旧版未加密的配置文件：删除后重建
    console.error('[main] 初始化 store 失败，重置配置文件:', error)
    const file = join(app.getPath('userData'), 'jeak-agent-settings.json')
    rmSync(file, { force: true })
    return new Store<AppSettings>(options)
  }
}

const store = createStore()

/* ==================== AI 服务（DeepSeek 流式） ==================== */

const aiService = new AIService({
  getApiKey: () => (store.get('ai') ?? DEFAULT_AI_SETTINGS).apiKey,
  getDefaultTemperature: () => (store.get('ai') ?? DEFAULT_AI_SETTINGS).temperature,
  getDefaultMaxTokens: () => (store.get('ai') ?? DEFAULT_AI_SETTINGS).maxTokens
})

/* ==================== Phase 3：插件系统 ==================== */

const pluginManager = new PluginManager({
  aiService,
  getMainWindow: () => mainWindow,
  getSettingsStore: () => store
})

/* ==================== 窗口管理 ==================== */

let mainWindow: BrowserWindow | null = null
let terminalService: TerminalService | null = null
/** 是否为「完全退出」：false 时点关闭仅隐藏到托盘 */
let isQuitting = false

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    title: 'Jeak Agent',
    icon: createAppIcon(),
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: join(__dirname, '../preload/mainPreload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 打开外部链接时交给系统浏览器，而非新开窗口
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // 开发模式加载 Vite Dev Server，生产模式加载打包后的 HTML
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // 关闭 = 隐藏到托盘（仅当「完全退出」时才真正关闭）
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    terminalService?.dispose()
    terminalService = null
    mainWindow = null
    // 关键：销毁所有插件沙箱窗口。插件沙箱是 show:false 的隐藏 BrowserWindow，
    // 若不销毁会阻止 window-all-closed 触发，导致点关闭后进程残留（幽灵进程）。
    void pluginManager.dispose()
  })

  // 创建终端服务（绑定主窗口 webContents）
  terminalService = new TerminalService(mainWindow.webContents)
}

/* ==================== IPC：应用信息 / 设置 ==================== */

function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (): AppSettings => {
    return readSettings()
  })

  ipcMain.handle('settings:set', (_event, patch: Partial<AppSettings>): AppSettings => {
    if (patch.theme !== undefined) store.set('theme', patch.theme)
    if (patch.language !== undefined) store.set('language', patch.language)
    if (patch.ai !== undefined) {
      store.set('ai', { ...(store.get('ai') ?? DEFAULT_AI_SETTINGS), ...patch.ai })
    }
    if (patch.plugins !== undefined) {
      store.set('plugins', { ...(store.get('plugins') ?? { disabled: [] }), ...patch.plugins })
    }
    if (patch.onboarded !== undefined) store.set('onboarded', patch.onboarded)
    if (patch.shortcuts !== undefined) {
      store.set('shortcuts', { ...DEFAULT_SHORTCUTS, ...patch.shortcuts })
    }
    if (patch.layout !== undefined) {
      store.set('layout', { ...DEFAULT_LAYOUT, ...patch.layout })
    }
    if (patch.recentProjects !== undefined) store.set('recentProjects', patch.recentProjects)
    if (patch.autoSave !== undefined) store.set('autoSave', patch.autoSave)
    return readSettings()
  })
}

function readSettings(): AppSettings {
  const theme = store.get('theme', 'dark')
  const language = store.get('language', 'zh')
  const ai = store.get('ai') ?? DEFAULT_AI_SETTINGS
  const plugins = store.get('plugins') ?? { disabled: [] }
  const onboarded = store.get('onboarded', false)
  const shortcuts = store.get('shortcuts') ?? DEFAULT_SHORTCUTS
  const layout = store.get('layout') ?? DEFAULT_LAYOUT
  const recentProjects = store.get('recentProjects') ?? []
  const autoSave = store.get('autoSave', false)
  return { theme, language, ai, plugins, onboarded, shortcuts, layout, recentProjects, autoSave }
}

/* ==================== IPC：AI 流式对话 ==================== */

function registerAiIpc(): void {
  ipcMain.on('ai:chat', (event, request: AIChatRequest) => {
    void aiService.chat(request, {
      onDelta: (id, delta) => event.sender.send('ai:chat:delta', { id, delta }),
      onDone: (id, aborted) => event.sender.send('ai:chat:done', { id, aborted }),
      onError: (id, message) => event.sender.send('ai:chat:error', { id, message })
    })
  })

  ipcMain.on('ai:chat:stop', (_event, id: string) => {
    aiService.stop(id)
  })
}

/* ==================== 应用生命周期 ==================== */

app.whenReady().then(() => {
  // Windows 任务栏分组/图标关联
  app.setAppUserModelId('com.jeak.agent')

  // 全局单实例锁：防止多个实例同时运行
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    app.quit()
    return
  }

  // IPC：返回应用信息（供渲染进程展示）
  ipcMain.handle('app:get-info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    theme: store.get('theme', 'dark'),
    language: store.get('language', 'zh'),
    onboarded: store.get('onboarded', false)
  }))

  registerSettingsIpc()
  registerAiIpc()
  registerTerminalIpc(() => terminalService)
  registerWindowControls(() => mainWindow)
  registerMenuIpc({
    getWindow: () => mainWindow,
    getRecentProjects: () => store.get('recentProjects', []),
    setRecentProjects: (list) => store.set('recentProjects', list)
  })

  createMainWindow()

  // 系统托盘：关闭后隐藏窗口，右键托盘可「完全退出」
  createTray(() => mainWindow, () => app.quit())

  // 初始化插件系统（发现 ~/.jeak/plugins + 启动已启用插件沙箱）
  void pluginManager.init().then(() => {
    console.log(`[plugins] 初始化完成，共 ${pluginManager.list().length} 个插件`)
  })

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  destroyTray()
  void pluginManager.dispose()
})

export { store, aiService, pluginManager }
