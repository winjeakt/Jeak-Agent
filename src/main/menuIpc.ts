import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { extname } from 'path'
import type { EditorLanguage, FileOpenResult, FileSaveResult, FolderOpenResult } from '../shared/types'

/** 最近打开项目的最大保留条数 */
const MAX_RECENT = 10

/** 根据文件扩展名推断 Monaco 语言 */
function inferLanguage(path: string): EditorLanguage {
  const ext = extname(path).slice(1).toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'mts':
    case 'cts':
      return 'typescript'
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript'
    case 'json':
      return 'json'
    case 'html':
    case 'htm':
      return 'html'
    case 'css':
      return 'css'
    case 'md':
    case 'markdown':
      return 'markdown'
    case 'py':
      return 'python'
    default:
      return 'plaintext'
  }
}

interface MenuIpcOptions {
  getWindow: () => BrowserWindow | null
  getRecentProjects: () => string[]
  setRecentProjects: (list: string[]) => void
}

/**
 * 注册菜单栏所需的主进程 IPC：
 * - 文件对话框（打开 / 保存 / 打开文件夹）
 * - 最近打开项目列表
 * - 窗口缩放 / 全屏
 * - shell（外部链接 / 日志文件夹）
 * - 应用信息 / 检查更新
 */
export function registerMenuIpc(opts: MenuIpcOptions): void {
  const { getWindow, getRecentProjects, setRecentProjects } = opts

  /** 有窗口时挂到窗口、否则使用全局对话框（规避 Electron 33 对 undefined 参数的限制） */
  const showOpenDialog = (options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> => {
    const win = getWindow()
    return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options)
  }

  const showSaveDialog = (options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> => {
    const win = getWindow()
    return win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options)
  }

  const addRecent = (path: string): void => {
    const list = getRecentProjects().filter((p) => p !== path)
    list.unshift(path)
    setRecentProjects(list.slice(0, MAX_RECENT))
  }

  /* ---------------- 文件对话框 ---------------- */

  ipcMain.handle('file:open', async (): Promise<FileOpenResult> => {
    const result = await showOpenDialog({
      title: '打开文件',
      properties: ['openFile'],
      filters: [
        { name: '代码文件', extensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'html', 'css', 'md', 'py'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true }
    const path = result.filePaths[0]
    try {
      const content = readFileSync(path, 'utf-8')
      addRecent(path)
      return { canceled: false, path, content, language: inferLanguage(path) }
    } catch {
      return { canceled: true }
    }
  })

  ipcMain.handle('file:open-folder', async (): Promise<FolderOpenResult> => {
    const result = await showOpenDialog({
      title: '打开文件夹',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true }
    const path = result.filePaths[0]
    addRecent(path)
    return { canceled: false, path }
  })

  ipcMain.handle(
    'file:save',
    async (_event, payload: { path?: string | null; content: string }): Promise<FileSaveResult> => {
      let target = payload.path || null
      if (!target) {
        const result = await showSaveDialog({
          title: '保存文件',
          defaultPath: 'untitled.txt'
        })
        if (result.canceled || !result.filePath) return { canceled: true }
        target = result.filePath
      }
      writeFileSync(target, payload.content, 'utf-8')
      addRecent(target)
      return { canceled: false, path: target }
    }
  )

  ipcMain.handle(
    'file:save-as',
    async (_event, payload: { content: string }): Promise<FileSaveResult> => {
      const result = await showSaveDialog({
        title: '另存为',
        defaultPath: 'untitled.txt'
      })
      if (result.canceled || !result.filePath) return { canceled: true }
      writeFileSync(result.filePath, payload.content, 'utf-8')
      addRecent(result.filePath)
      return { canceled: false, path: result.filePath }
    }
  )

  /* ---------------- 最近打开项目 ---------------- */

  ipcMain.handle('recent:list', (): string[] => getRecentProjects())

  ipcMain.handle('recent:add', (_event, path: string): string[] => {
    addRecent(path)
    return getRecentProjects()
  })

  ipcMain.handle('recent:clear', (): string[] => {
    setRecentProjects([])
    return []
  })

  /* ---------------- 窗口（缩放 / 全屏） ---------------- */

  ipcMain.on('window:fullscreen', () => {
    const win = getWindow()
    if (!win) return
    win.setFullScreen(!win.isFullScreen())
  })

  ipcMain.on('window:zoom-in', () => {
    const win = getWindow()
    if (!win) return
    win.webContents.setZoomLevel(Math.min(win.webContents.getZoomLevel() + 0.5, 5))
  })

  ipcMain.on('window:zoom-out', () => {
    const win = getWindow()
    if (!win) return
    win.webContents.setZoomLevel(Math.max(win.webContents.getZoomLevel() - 0.5, -5))
  })

  ipcMain.on('window:zoom-reset', () => {
    getWindow()?.webContents.setZoomLevel(0)
  })

  /* ---------------- shell ---------------- */

  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    await shell.openExternal(url)
    return { ok: true }
  })

  ipcMain.handle('shell:open-logs', async () => {
    const logsPath = app.getPath('logs')
    mkdirSync(logsPath, { recursive: true })
    const error = await shell.openPath(logsPath)
    return { ok: !error, path: logsPath }
  })

  /* ---------------- 应用信息 ---------------- */

  ipcMain.handle('app:about', () => ({
    name: 'Jeak Agent',
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform
  }))

  ipcMain.handle('app:check-update', async () => {
    // 占位：后续接入更新源
    return { available: false, version: app.getVersion() }
  })
}
