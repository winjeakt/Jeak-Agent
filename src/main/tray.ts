import { BrowserWindow, Menu, Tray } from 'electron'
import { createAppIcon } from './icon'

let tray: Tray | null = null

/**
 * 创建系统托盘：点关闭后隐藏主窗口，仅保留托盘小图标。
 * - 单击托盘图标：显示主窗口
 * - 右键托盘图标：「显示主窗口」/「完全退出」
 */
export function createTray(
  getWindow: () => BrowserWindow | null,
  onQuit: () => void
): Tray {
  const icon = createAppIcon()
  tray = new Tray(icon)
  tray.setToolTip('Jeak Agent')

  const showWindow = (): void => {
    const win = getWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  }

  // 单击 / 双击托盘图标 → 显示主窗口（跨平台兼容）
  tray.on('click', showWindow)
  tray.on('double-click', showWindow)

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示主窗口', click: showWindow },
      { type: 'separator' },
      { label: '完全退出', click: onQuit }
    ])
  )

  return tray
}

/** 销毁托盘图标（应用退出时调用） */
export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
