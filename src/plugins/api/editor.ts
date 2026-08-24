import { ipcMain } from 'electron'
import type { EditorAction, EditorApplyAction, EditorShowDiagnosticsAction } from '../../shared/types'
import type { PluginApiDeps } from './types'

/**
 * 插件 editor API：editor.getState / editor.apply / editor.showDiagnostics
 * - 读取主进程维护的编辑器状态镜像（渲染进程实时同步）
 * - 写入动作转发给主窗口渲染进程执行（仅支持白名单动作类型）
 */
export function registerEditorApi(deps: PluginApiDeps): void {
  ipcMain.handle('plugin:editor:get-state', (event) => {
    const ctx = deps.getContext(event)
    ctx.requirePermission('editor:get')
    return deps.getEditorState()
  })

  ipcMain.handle('plugin:editor:apply', (event, action: EditorApplyAction) => {
    const ctx = deps.getContext(event)
    ctx.requirePermission('editor:apply')
    if (
      typeof action !== 'object' ||
      action === null ||
      action.type !== 'replace-selection' ||
      typeof action.text !== 'string' ||
      action.text.length > 5 * 1024 * 1024
    ) {
      throw new Error('无效的编辑器写入动作')
    }
    const win = deps.getMainWindow()
    if (!win || win.isDestroyed()) throw new Error('主窗口不可用')
    win.webContents.send('editor:apply', action)
    return { ok: true }
  })

  // 显示问题列表（Markers / 底部问题面板）
  ipcMain.handle('plugin:editor:show-diagnostics', (event, action: EditorShowDiagnosticsAction) => {
    const ctx = deps.getContext(event)
    ctx.requirePermission('editor:apply')
    if (
      typeof action !== 'object' ||
      action === null ||
      action.type !== 'show-diagnostics' ||
      !Array.isArray(action.diagnostics)
    ) {
      throw new Error('无效的 show-diagnostics 动作')
    }
    if (action.diagnostics.length > 500) {
      throw new Error('诊断数量超过上限（500）')
    }
    const win = deps.getMainWindow()
    if (!win || win.isDestroyed()) throw new Error('主窗口不可用')
    win.webContents.send('editor:show-diagnostics', action)
    return { ok: true }
  })
}

/** 供类型导出使用 */
export type { EditorAction }

