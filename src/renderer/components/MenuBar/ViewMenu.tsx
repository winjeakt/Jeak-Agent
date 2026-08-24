import { useT } from '../../stores/i18nStore'
import { useLayoutStore } from '../../stores/layoutStore'
import { useThemeStore } from '../../stores/themeStore'
import { useUIStore } from '../../stores/uiStore'
import type { MenuItem } from './types'

/** "视图"菜单：面板显隐 / 主题 / 缩放 / 全屏 / 编辑器组 */
export function useViewMenuItems(): MenuItem[] {
  const t = useT()
  const toggle = useLayoutStore((s) => s.toggle)
  const setLayout = useLayoutStore((s) => s.setLayout)
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const openSettings = useUIStore((s) => s.openSettings)
  const toggleSearch = useUIStore((s) => s.toggleSearch)

  const themeSubmenu: MenuItem[] = [
    { id: 'theme-dark', label: t('menu.view.themeDark'), checked: theme === 'dark', onClick: () => setTheme('dark') },
    { id: 'theme-light', label: t('menu.view.themeLight'), checked: theme === 'light', onClick: () => setTheme('light') },
    { id: 'theme-system', label: t('menu.view.themeSystem'), checked: theme === 'system', onClick: () => setTheme('system') }
  ]

  const editorGroupSubmenu: MenuItem[] = [1, 2, 3].map((n) => ({
    id: `group-${n}`,
    label: `${t('menu.view.editorGroup')} ${n}`,
    shortcut: `Ctrl+${n}`,
    onClick: () => console.log(`[menu] 切换到编辑器组 ${n}（占位）`)
  }))

  return [
    { id: 'toggle-sidebar', label: t('menu.view.toggleSidebar'), shortcut: 'Ctrl+B', onClick: () => toggle('showFileTree') },
    { id: 'sep-1', label: '', separator: true },
    { id: 'file-panel', label: t('menu.view.filePanel'), shortcut: 'Ctrl+Shift+E', onClick: () => setLayout({ showFileTree: true }) },
    { id: 'search-panel', label: t('menu.view.searchPanel'), shortcut: 'Ctrl+Shift+F', onClick: toggleSearch },
    { id: 'plugins-panel', label: t('menu.view.pluginsPanel'), shortcut: 'Ctrl+Shift+X', onClick: () => openSettings('plugins') },
    { id: 'toggle-terminal', label: t('menu.view.toggleTerminal'), shortcut: 'Ctrl+`', onClick: () => toggle('showTerminal') },
    { id: 'debug-panel', label: t('menu.view.debugPanel'), shortcut: 'Ctrl+Shift+D', onClick: () => console.log('[menu] 调试面板（占位）') },
    { id: 'output-panel', label: t('menu.view.outputPanel'), shortcut: 'Ctrl+Shift+U', onClick: () => console.log('[menu] 输出面板（占位）') },
    { id: 'sep-2', label: '', separator: true },
    { id: 'theme', label: t('menu.view.theme'), submenu: themeSubmenu },
    { id: 'sep-3', label: '', separator: true },
    { id: 'zoom-in', label: t('menu.view.zoomIn'), shortcut: 'Ctrl+=', onClick: () => window.jeak.window.zoomIn() },
    { id: 'zoom-out', label: t('menu.view.zoomOut'), shortcut: 'Ctrl+-', onClick: () => window.jeak.window.zoomOut() },
    { id: 'zoom-reset', label: t('menu.view.zoomReset'), onClick: () => window.jeak.window.zoomReset() },
    { id: 'sep-4', label: '', separator: true },
    { id: 'fullscreen', label: t('menu.view.fullscreen'), shortcut: 'F11', onClick: () => window.jeak.window.toggleFullscreen() },
    { id: 'sep-5', label: '', separator: true },
    { id: 'editor-group', label: t('menu.view.editorGroup'), submenu: editorGroupSubmenu }
  ]
}
