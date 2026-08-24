import { useT } from '../../stores/i18nStore'
import type { MenuItem } from './types'

const REPO_URL = 'https://github.com/winjeakt/Jeak-Agent'

/** "帮助"菜单：文档 / 反馈 / GitHub / 日志 / 更新 / 关于 */
export function useHelpMenuItems(): MenuItem[] {
  const t = useT()

  const showAbout = async (): Promise<void> => {
    const info = await window.jeak.app.about()
    const lines = [
      `${info.name} v${info.version}`,
      `Electron ${info.electron}`,
      `Chromium ${info.chrome}`,
      `Node ${info.node}`,
      `Platform ${info.platform}`
    ]
    window.alert(lines.join('\n'))
  }

  return [
    { id: 'docs', label: t('menu.help.docs'), shortcut: 'F1', onClick: () => void window.jeak.shell.openExternal(REPO_URL) },
    { id: 'feedback', label: t('menu.help.feedback'), onClick: () => void window.jeak.shell.openExternal(`${REPO_URL}/issues`) },
    { id: 'star', label: t('menu.help.star'), onClick: () => void window.jeak.shell.openExternal(REPO_URL) },
    { id: 'sep-1', label: '', separator: true },
    { id: 'open-logs', label: t('menu.help.openLogs'), onClick: () => void window.jeak.shell.openLogs() },
    {
      id: 'check-update',
      label: t('menu.help.checkUpdate'),
      onClick: () => {
        void (async (): Promise<void> => {
          const r = await window.jeak.app.checkUpdate()
          if (r.dev) {
            window.alert('开发模式无法检查更新，请使用打包后的应用')
            return
          }
          if (!r.available) {
            window.alert('已是最新版本')
            return
          }
          const doDownload = window.confirm(`发现新版本 v${r.version}，是否立即下载更新？`)
          if (!doDownload) return
          const dl = await window.jeak.app.downloadUpdate()
          if (!dl.ok) {
            window.alert(`下载失败：${dl.error ?? '未知错误'}`)
            return
          }
          const doInstall = window.confirm(`新版本 v${r.version} 已下载完成，是否重启并安装？`)
          if (doInstall) void window.jeak.app.installUpdate()
        })()
      }
    },
    { id: 'sep-2', label: '', separator: true },
    { id: 'about', label: t('menu.help.about'), onClick: () => void showAbout() }
  ]
}
