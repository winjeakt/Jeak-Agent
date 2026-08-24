import { useT } from '../../stores/i18nStore'
import { useLayoutStore } from '../../stores/layoutStore'
import { useTerminalStore } from '../../stores/terminalStore'
import type { MenuItem } from './types'

/** "终端"菜单：新建 / 拆分 / 清空 / 终止 / 重启 / Shell 选择 */
export function useTerminalMenuItems(): MenuItem[] {
  const t = useT()
  const start = useTerminalStore((s) => s.start)
  const dispose = useTerminalStore((s) => s.dispose)
  const clear = useTerminalStore((s) => s.clear)
  const setLayout = useLayoutStore((s) => s.setLayout)

  const newTerminal = (): void => {
    setLayout({ showTerminal: true })
    start()
  }

  const restartTerminal = (): void => {
    dispose()
    start()
  }

  const shellSubmenu: MenuItem[] = [
    { id: 'shell-powershell', label: 'PowerShell', onClick: () => console.log('[menu] 选择 Shell: PowerShell（占位）') },
    { id: 'shell-cmd', label: 'CMD', onClick: () => console.log('[menu] 选择 Shell: CMD（占位）') },
    { id: 'shell-bash', label: 'Bash', onClick: () => console.log('[menu] 选择 Shell: Bash（占位）') }
  ]

  return [
    { id: 'new', label: t('menu.terminal.new'), shortcut: 'Ctrl+Shift+`', onClick: newTerminal },
    { id: 'split', label: t('menu.terminal.split'), shortcut: 'Ctrl+Shift+5', onClick: () => console.log('[menu] 拆分终端（占位）') },
    { id: 'rename', label: t('menu.terminal.rename'), onClick: () => console.log('[menu] 重命名终端（占位）') },
    { id: 'sep-1', label: '', separator: true },
    { id: 'clear', label: t('menu.terminal.clear'), shortcut: 'Ctrl+K', onClick: clear },
    { id: 'kill', label: t('menu.terminal.kill'), onClick: dispose },
    { id: 'restart', label: t('menu.terminal.restart'), onClick: restartTerminal },
    { id: 'sep-2', label: '', separator: true },
    { id: 'copy-selection', label: t('menu.terminal.copySelection'), shortcut: 'Ctrl+Shift+C', onClick: () => console.log('[menu] 复制选择（占位）') },
    { id: 'paste', label: t('menu.terminal.paste'), shortcut: 'Ctrl+Shift+V', onClick: () => console.log('[menu] 粘贴（占位）') },
    { id: 'sep-3', label: '', separator: true },
    { id: 'settings', label: t('menu.terminal.settings'), submenu: shellSubmenu },
    { id: 'history', label: t('menu.terminal.history'), onClick: () => console.log('[menu] 终端历史（占位）') }
  ]
}
