import { contextBridge, ipcRenderer } from 'electron'
import type {
  AIChatRequest,
  AppSettings,
  Diagnostic,
  EditorApplyAction,
  EditorShowDiagnosticsAction,
  EditorStateSnapshot,
  PluginInfo
} from '../shared/types'

// 通过 contextBridge 向渲染进程暴露受限 API。
// 安全模型：sandbox + contextIsolation，仅暴露白名单通道。
const api = {
  getAppInfo: (): Promise<{ version: string; platform: string; theme: string }> =>
    ipcRenderer.invoke('app:get-info'),
  onThemeChange: (callback: (theme: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: string): void => {
      callback(theme)
    }
    ipcRenderer.on('app:theme-changed', listener)
    return () => {
      ipcRenderer.removeListener('app:theme-changed', listener)
    }
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
    }
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
    /** 订阅插件列表 / 状态变化 */
    onChanged: (callback: (plugins: PluginInfo[]) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, plugins: PluginInfo[]): void =>
        callback(plugins)
      ipcRenderer.on('plugins:changed', listener)
      return () => {
        ipcRenderer.removeListener('plugins:changed', listener)
      }
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
  // @ts-ignore fallback（仅当 contextIsolation 关闭时）
  window.jeak = api
}

export type JeakAPI = typeof api
