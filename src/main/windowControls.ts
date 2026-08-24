import { ipcMain, type BrowserWindow } from 'electron'

/**
 * 窗口控制 IPC：处理标题栏自定义按钮（最小化/最大化/关闭）的请求。
 * 通过 getWindow 回调获取目标窗口（通常是主窗口）。
 */
export function registerWindowControls(getWindow: () => BrowserWindow | null): void {
  ipcMain.on('window:minimize', () => {
    getWindow()?.minimize()
  })

  ipcMain.on('window:toggle-maximize', () => {
    const win = getWindow()
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  ipcMain.on('window:close', () => {
    getWindow()?.close()
  })

  // 查询窗口是否最大化（用于初始化按钮状态）
  ipcMain.handle('window:is-maximized', () => {
    return getWindow()?.isMaximized() ?? false
  })
}
