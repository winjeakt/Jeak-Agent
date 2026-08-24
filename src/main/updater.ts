import { app, ipcMain, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { CheckUpdateResult, UpdateState } from '../shared/types'

/** 当前更新状态（广播给渲染进程） */
const state: UpdateState = {
  status: 'idle',
  version: '',
  percent: 0,
  error: null
}

function broadcast(getWindow: () => BrowserWindow | null): void {
  const win = getWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('app:update-state', { ...state })
  }
}

/**
 * 初始化自动更新（electron-updater）。
 * 更新源由 electron-builder.yml 的 publish 配置决定（GitHub Releases）。
 */
export function setupAutoUpdater(getWindow: () => BrowserWindow | null): void {
  // 不自动下载，由用户手动触发；应用退出时安装已下载的更新
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // Windows：未配置代码签名证书时，跳过更新包签名校验（否则自动更新会失败）
  if (process.platform === 'win32') {
    ;(autoUpdater as unknown as { verifyUpdateCodeSignature: boolean }).verifyUpdateCodeSignature =
      false
  }

  autoUpdater.on('checking-for-update', () => {
    state.status = 'checking'
    state.error = null
    broadcast(getWindow)
  })

  autoUpdater.on('update-available', (info) => {
    state.status = 'available'
    state.version = info.version
    broadcast(getWindow)
  })

  autoUpdater.on('update-not-available', (info) => {
    state.status = 'not-available'
    state.version = info.version
    broadcast(getWindow)
  })

  autoUpdater.on('download-progress', (progress) => {
    state.status = 'downloading'
    state.percent = progress.percent
    broadcast(getWindow)
  })

  autoUpdater.on('update-downloaded', (info) => {
    state.status = 'downloaded'
    state.version = info.version
    broadcast(getWindow)
  })

  autoUpdater.on('error', (error) => {
    state.status = 'error'
    state.error = error.message
    broadcast(getWindow)
  })

  /* ---------------- IPC ---------------- */

  ipcMain.handle('app:check-update', async (): Promise<CheckUpdateResult> => {
    // 开发模式（未打包）不检查更新，避免读取不到 app-update.yml 而报错
    if (!app.isPackaged) {
      return { available: false, version: app.getVersion(), dev: true }
    }
    const result = await autoUpdater.checkForUpdates()
    const version = result?.updateInfo?.version ?? app.getVersion()
    return { available: version !== app.getVersion(), version }
  })

  ipcMain.handle('app:download-update', async (): Promise<{ ok: boolean; error?: string }> => {
    if (!app.isPackaged) return { ok: false, error: 'dev-mode' }
    try {
      await autoUpdater.downloadUpdate()
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('app:install-update', (): { ok: boolean } => {
    autoUpdater.quitAndInstall()
    return { ok: true }
  })

  ipcMain.handle('app:update-state', (): UpdateState => ({ ...state }))
}
