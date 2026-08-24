import { contextBridge, ipcRenderer } from 'electron'
import type {
  AIChatRequest,
  Diagnostic,
  EditorApplyAction,
  EditorShowDiagnosticsAction,
  GitDiffRequest,
  GitRunRequest,
  LintRunRequest
} from '../shared/types'

/**
 * 插件窗口 preload（运行在 Electron 沙箱内，仅可 require('electron')）。
 * 这是插件访问能力的【唯一入口】：通过 contextBridge 暴露 window.pluginAPI，
 * 插件代码无法接触到 Node.js、Electron 原生模块或系统 API。
 */

/** 插件命令分发回调（由插件脚本通过 onCommand 注册，闭包仅捕获插件自身状态） */
type CommandDispatch = (command: string) => void | Promise<void>

let commandDispatch: CommandDispatch | null = null

// 主进程触发命令（插件管理面板点击"运行"）
ipcRenderer.on('plugin:command:run', (_event, payload: { command?: string }) => {
  if (typeof payload?.command !== 'string') return
  if (commandDispatch) void commandDispatch(payload.command)
})

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api = {
  /** AI 能力（需 plugin.json 声明权限） */
  ai: {
    /** 一次性对话，返回完整文本 */
    chat: (request: AIChatRequest): Promise<string> => ipcRenderer.invoke('plugin:ai:chat', request),
    /** 流式对话，增量通过 onDelta 接收 */
    streamChat: (request: AIChatRequest): void => {
      ipcRenderer.send('plugin:ai:stream', request)
    },
    /** 停止流式 */
    stop: (id: string): void => {
      ipcRenderer.send('plugin:ai:stream:stop', id)
    },
    onDelta: (callback: (payload: { id: string; delta: string }) => void): (() => void) =>
      subscribe('plugin:ai:delta', callback),
    onDone: (callback: (payload: { id: string; aborted?: boolean }) => void): (() => void) =>
      subscribe('plugin:ai:done', callback),
    onError: (callback: (payload: { id: string; message: string }) => void): (() => void) =>
      subscribe('plugin:ai:error', callback)
  },
  /** 文件系统能力（主进程强校验路径白名单与大小上限） */
  fs: {
    readTextFile: (filePath: string): Promise<string> =>
      ipcRenderer.invoke('plugin:fs:read-text', filePath),
    writeTextFile: (filePath: string, content: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('plugin:fs:write-text', filePath, content)
  },
  /** 编辑器能力 */
  editor: {
    /** 读取编辑器状态（当前文件、内容、选区文本） */
    getState: (): Promise<unknown> => ipcRenderer.invoke('plugin:editor:get-state'),
    /** 用文本替换当前选区 */
    replaceSelection: (text: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('plugin:editor:apply', {
        type: 'replace-selection',
        text
      } satisfies EditorApplyAction),
    /** 显示问题列表（Markers / 底部问题面板） */
    showDiagnostics: (diagnostics: Diagnostic[]): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('plugin:editor:show-diagnostics', {
        type: 'show-diagnostics',
        diagnostics
      } satisfies EditorShowDiagnosticsAction)
  },
  /** Git 能力（主进程执行受限 git 命令） */
  git: {
    /** 查看工作区/暂存区 diff */
    diff: (request: GitDiffRequest): Promise<string> => ipcRenderer.invoke('plugin:git:diff', request),
    /** 查看 git status（--short --branch） */
    status: (request?: { cwd?: string }): Promise<string> =>
      ipcRenderer.invoke('plugin:git:status', request ?? {}),
    /** 执行受限的 git 子命令 */
    run: (request: GitRunRequest): Promise<string> => ipcRenderer.invoke('plugin:git:run', request)
  },
  /** Lint 能力（主进程运行 ESLint） */
  lint: {
    run: (request: LintRunRequest): Promise<{ filePath: string; diagnostics: Diagnostic[] }> =>
      ipcRenderer.invoke('plugin:lint:run', request)
  },
  /** 项目能力 */
  project: {
    get: (): Promise<{ root: string | null; openFiles: string[] }> =>
      ipcRenderer.invoke('plugin:project:get')
  },
  /**
   * 注册命令元信息（仅传字符串，避免跨桥序列化复杂闭包）。
   * 命令的执行业务逻辑由插件脚本通过 onCommand 自行分发。
   */
  registerCommand: (command: string, title: string): void => {
    if (typeof command !== 'string' || typeof title !== 'string') return
    ipcRenderer.send('plugin:command:register', { command, title })
  },
  /** 订阅命令触发事件：主进程点击"运行"时回调 command */
  onCommand: (callback: CommandDispatch): void => {
    commandDispatch = callback
  },
  /** 输出日志（主进程 console） */
  log: (level: 'info' | 'warn' | 'error', message: string): void => {
    ipcRenderer.send('plugin:log', { level, message })
  },
  /** 运行环境信息 */
  meta: {
    platform: process.platform
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('pluginAPI', api)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[pluginPreload] 暴露 pluginAPI 失败:', message)
    ipcRenderer.send('plugin:log', {
      level: 'error',
      message: `pluginAPI 暴露失败: ${message}`
    })
  }
} else {
  // @ts-ignore fallback（仅当 contextIsolation 关闭时）
  window.pluginAPI = api
}

export type PluginAPI = typeof api
