import { contextBridge, ipcRenderer } from 'electron'
import type {
  AIChatRequest,
  AIToolDefinition,
  AppSettings,
  AwesomePluginInfo,
  CheckUpdateResult,
  EditorApplyAction,
  EditorShowDiagnosticsAction,
  EditorStateSnapshot,
  FileOpenResult,
  FileSaveResult,
  FileTreeNode,
  FolderOpenResult,
  MarketPluginInfo,
  OfficialPluginEntry,
  PluginInfo,
  ShellKind,
  UpdateState,
  WorkspaceOpenResult
} from '../shared/types'

// 通过 contextBridge 向渲染进程暴露受限 API。
// 安全模型：sandbox + contextIsolation，仅暴露白名单通道。
const api = {
  getAppInfo: (): Promise<{
    version: string
    platform: string
    theme: string
    language: string
    onboarded: boolean
  }> => ipcRenderer.invoke('app:get-info'),
  onThemeChange: (callback: (theme: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: string): void => {
      callback(theme)
    }
    ipcRenderer.on('app:theme-changed', listener)
    return () => {
      ipcRenderer.removeListener('app:theme-changed', listener)
    }
  },
  /** 订阅主进程致命错误（全局错误处理） */
  onFatalError: (callback: (message: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string): void => {
      callback(message)
    }
    ipcRenderer.on('app:fatal-error', listener)
    return () => {
      ipcRenderer.removeListener('app:fatal-error', listener)
    }
  },
  /** 窗口控制（自定义标题栏 / 菜单栏） */
  window: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    toggleMaximize: (): void => ipcRenderer.send('window:toggle-maximize'),
    close: (): void => ipcRenderer.send('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
    toggleFullscreen: (): void => ipcRenderer.send('window:fullscreen'),
    zoomIn: (): void => ipcRenderer.send('window:zoom-in'),
    zoomOut: (): void => ipcRenderer.send('window:zoom-out'),
    zoomReset: (): void => ipcRenderer.send('window:zoom-reset')
  },
  /** 设置读写（API Key 等，主进程加密存储） */
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke('settings:set', patch)
  },
  /** DeepSeek 流式对话 */
  ai: {
    /** 发起流式对话，结果通过 onDelta / onDone / onError 回调 */
    chat: (request: AIChatRequest): void => {
      ipcRenderer.send('ai:chat', request)
    },
    /** 停止指定会话的流式响应 */
    stop: (id: string): void => {
      ipcRenderer.send('ai:chat:stop', id)
    },
    /** 订阅流式增量 */
    onDelta: (callback: (payload: { id: string; delta: string }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { id: string; delta: string }): void =>
        callback(payload)
      ipcRenderer.on('ai:chat:delta', listener)
      return () => {
        ipcRenderer.removeListener('ai:chat:delta', listener)
      }
    },
    /** 订阅完成事件 */
    onDone: (callback: (payload: { id: string; aborted?: boolean }) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: { id: string; aborted?: boolean }
      ): void => callback(payload)
      ipcRenderer.on('ai:chat:done', listener)
      return () => {
        ipcRenderer.removeListener('ai:chat:done', listener)
      }
    },
    /** 订阅错误事件 */
    onError: (callback: (payload: { id: string; message: string }) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: { id: string; message: string }
      ): void => callback(payload)
      ipcRenderer.on('ai:chat:error', listener)
      return () => {
        ipcRenderer.removeListener('ai:chat:error', listener)
      }
    },
    /** 订阅工具调用事件（function calling） */
    onToolCall: (
      callback: (payload: { id: string; name: string; argsJson: string }) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: { id: string; name: string; argsJson: string }
      ): void => callback(payload)
      ipcRenderer.on('ai:chat:tool-call', listener)
      return () => {
        ipcRenderer.removeListener('ai:chat:tool-call', listener)
      }
    },
    /** 订阅工具执行结果事件 */
    onToolResult: (
      callback: (payload: { id: string; name: string; ok: boolean; result: string }) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: { id: string; name: string; ok: boolean; result: string }
      ): void => callback(payload)
      ipcRenderer.on('ai:chat:tool-result', listener)
      return () => {
        ipcRenderer.removeListener('ai:chat:tool-result', listener)
      }
    }
  },
  /** MCP 工具 */
  mcp: {
    /** 获取当前已加载的 MCP 工具列表 */
    listTools: (): Promise<AIToolDefinition[]> => ipcRenderer.invoke('mcp:list-tools')
  },
  /** 编辑器状态同步与插件写入（Phase 3） */
  editor: {
    /** 渲染进程上报编辑器状态镜像（供插件 editor API 读取） */
    sync: (state: EditorStateSnapshot): void => {
      ipcRenderer.send('editor:sync', state)
    },
    /** 订阅插件发起的编辑器写入动作（如 replace-selection） */
    onApply: (callback: (action: EditorApplyAction) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, action: EditorApplyAction): void =>
        callback(action)
      ipcRenderer.on('editor:apply', listener)
      return () => {
        ipcRenderer.removeListener('editor:apply', listener)
      }
    },
    /** 订阅插件发起的"显示问题列表"动作 */
    onShowDiagnostics: (callback: (action: EditorShowDiagnosticsAction) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        action: EditorShowDiagnosticsAction
      ): void => callback(action)
      ipcRenderer.on('editor:show-diagnostics', listener)
      return () => {
        ipcRenderer.removeListener('editor:show-diagnostics', listener)
      }
    }
  },
  /** 插件管理（Phase 3） */
  plugins: {
    /** 获取已发现插件列表（含状态） */
    list: (): Promise<PluginInfo[]> => ipcRenderer.invoke('plugins:list'),
    /** 启用 / 禁用插件 */
    toggle: (name: string, enabled: boolean): Promise<PluginInfo[]> =>
      ipcRenderer.invoke('plugins:toggle', name, enabled),
    /** 在系统文件管理器中打开插件目录 */
    openDir: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('plugins:open-dir'),
    /** 触发插件命令（如"运行格式化"） */
    runCommand: (command: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('plugins:run-command', command),
    /** 卸载插件（删除插件目录） */
    uninstall: (name: string): Promise<PluginInfo[]> =>
      ipcRenderer.invoke('plugins:uninstall', name),
    /** 从本地目录安装插件（弹出目录选择对话框） */
    installLocal: (): Promise<PluginInfo[]> => ipcRenderer.invoke('plugins:install-local'),
    /** 创建新插件模板 */
    create: (name: string): Promise<PluginInfo[]> => ipcRenderer.invoke('plugins:create', name),
    /** 获取插件市场列表（含是否已安装标记） */
    listMarket: (): Promise<MarketPluginInfo[]> => ipcRenderer.invoke('plugins:market:list'),
    /** 从插件市场安装插件 */
    installFromMarket: (name: string): Promise<PluginInfo[]> =>
      ipcRenderer.invoke('plugins:market:install', name),
    /** 从 GitHub 仓库地址安装插件（force 为 true 时覆盖已安装版本） */
    installFromGithub: (url: string, force = false): Promise<PluginInfo[]> =>
      ipcRenderer.invoke('plugins:install-github', url, force),
    /** 获取 Awesome Copilot 在线市场插件列表（主进程缓存 5 分钟，force 时强制刷新） */
    listAwesome: (force = false): Promise<AwesomePluginInfo[]> =>
      ipcRenderer.invoke('plugins:awesome:list', force),
    /** 获取官方插件索引（精选 + 官方推荐，主进程内联数据） */
    listOfficial: (): Promise<OfficialPluginEntry[]> =>
      ipcRenderer.invoke('plugins:official:list'),
    /** 订阅插件列表 / 状态变化 */
    onChanged: (callback: (plugins: PluginInfo[]) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, plugins: PluginInfo[]): void =>
        callback(plugins)
      ipcRenderer.on('plugins:changed', listener)
      return () => {
        ipcRenderer.removeListener('plugins:changed', listener)
      }
    }
  },
  /** 终端（Phase 6，多会话） */
  terminal: {
    /** 启动 shell 会话（sessionId 由渲染层生成） */
    start: (sessionId: string, shell?: ShellKind): void =>
      ipcRenderer.send('terminal:start', sessionId, shell),
    /** 向指定会话写入输入（命令） */
    write: (sessionId: string, input: string): void =>
      ipcRenderer.send('terminal:write', sessionId, input),
    /** 终止指定会话 */
    dispose: (sessionId: string): void => ipcRenderer.send('terminal:dispose', sessionId),
    /** 订阅终端输出 */
    onOutput: (
      callback: (payload: { sessionId: string; kind: string; data: string }) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: { sessionId: string; kind: string; data: string }
      ): void => callback(payload)
      ipcRenderer.on('terminal:output', listener)
      return () => {
        ipcRenderer.removeListener('terminal:output', listener)
      }
    }
  },
  /** 文件对话框（菜单栏"文件"菜单） */
  file: {
    open: (): Promise<FileOpenResult> => ipcRenderer.invoke('file:open'),
    openFolder: (): Promise<FolderOpenResult> => ipcRenderer.invoke('file:open-folder'),
    save: (path: string | null, content: string): Promise<FileSaveResult> =>
      ipcRenderer.invoke('file:save', { path, content }),
    saveAs: (content: string): Promise<FileSaveResult> =>
      ipcRenderer.invoke('file:save-as', { content })
  },
  /** 最近打开的项目（菜单栏"文件"菜单） */
  recent: {
    list: (): Promise<string[]> => ipcRenderer.invoke('recent:list'),
    add: (path: string): Promise<string[]> => ipcRenderer.invoke('recent:add', path),
    clear: (): Promise<string[]> => ipcRenderer.invoke('recent:clear')
  },
  /** 工作区（文件树 / 按路径打开） */
  workspace: {
    readTree: (path: string): Promise<FileTreeNode[]> => ipcRenderer.invoke('workspace:read-tree', path),
    openPath: (path: string): Promise<WorkspaceOpenResult> => ipcRenderer.invoke('workspace:open-path', path)
  },
  /** shell（外部链接 / 日志文件夹，菜单栏"帮助"菜单） */
  shell: {
    openExternal: (url: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('shell:open-external', url),
    openLogs: (): Promise<{ ok: boolean; path: string }> => ipcRenderer.invoke('shell:open-logs')
  },
  /** 应用信息 & 自动更新（菜单栏"帮助"菜单） */
  app: {
    about: (): Promise<{
      name: string
      version: string
      electron: string
      chrome: string
      node: string
      platform: string
    }> => ipcRenderer.invoke('app:about'),
    checkUpdate: (): Promise<CheckUpdateResult> => ipcRenderer.invoke('app:check-update'),
    downloadUpdate: (): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('app:download-update'),
    installUpdate: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('app:install-update'),
    onUpdateState: (callback: (state: UpdateState) => void): (() => void) => {
      const listener = (_event: unknown, state: UpdateState): void => callback(state)
      ipcRenderer.on('app:update-state', listener)
      return () => ipcRenderer.removeListener('app:update-state', listener)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('jeak', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // fallback（仅当 contextIsolation 关闭时）
  ;(globalThis as unknown as { jeak: typeof api }).jeak = api
}

export type JeakAPI = typeof api
