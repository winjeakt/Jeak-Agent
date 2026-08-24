import { useT } from '../../stores/i18nStore'
import { useLayoutStore } from '../../stores/layoutStore'
import { useTerminalStore, type TerminalSessionState } from '../../stores/terminalStore'
import type { ShellKind } from '@shared/types'
import type { MenuItem } from './types'

/** "终端"菜单 */
export function useTerminalMenuItems(): MenuItem[] {
  const t = useT()
  const setLayout = useLayoutStore((s) => s.setLayout)

  const activeSession = (): TerminalSessionState | undefined => {
    const store = useTerminalStore.getState()
    return store.sessions.find((s) => s.id === store.activeId) ?? store.sessions[0]
  }

  const openAndCreate = (shell?: ShellKind): void => {
    const store = useTerminalStore.getState()
    setLayout({ showTerminal: true })
    const id = store.createSession(shell)
    store.start(id)
  }

  const renameActive = (): void => {
    const active = activeSession()
    if (!active) return
    const name = window.prompt(t('menu.terminal.rename'), active.name)
    if (name) useTerminalStore.getState().renameSession(active.id, name)
  }

  const killActive = (): void => {
    const active = activeSession()
    if (active) useTerminalStore.getState().closeSession(active.id)
  }

  const restartActive = (): void => {
    const active = activeSession()
    if (!active) return
    const store = useTerminalStore.getState()
    store.dispose(active.id)
    store.start(active.id)
  }

  const clearActive = (): void => {
    const active = activeSession()
    if (active) useTerminalStore.getState().clear(active.id)
  }

  const copySelection = (): void => {
    const text = window.getSelection()?.toString() ?? ''
    if (text) void navigator.clipboard.writeText(text)
  }

  const paste = (): void => {
    const active = activeSession()
    if (!active) return
    void navigator.clipboard.readText().then((text) => {
      if (!text) return
      const s = activeSession()
      if (s) useTerminalStore.getState().setInput(s.id, s.input + text)
    })
  }

  const showHistory = (): void => {
    const active = activeSession()
    if (!active) return
    const text =
      active.history.length === 0
        ? t('terminal.history.empty')
        : active.history.map((h, i) => ` ${i + 1}  ${h}`).join('\r\n')
    useTerminalStore.getState().appendOutput(active.id, 'system', `\r\n${text}\r\n`)
  }

  const shellLabels: Record<ShellKind, string> = {
    powershell: t('terminal.shell.powershell'),
    cmd: t('terminal.shell.cmd'),
    bash: t('terminal.shell.bash')
  }

  const shellSubmenu: MenuItem[] = (['powershell', 'cmd', 'bash'] as ShellKind[]).map((shell) => ({
    id: `shell-${shell}`,
    label: shellLabels[shell],
    onClick: () => openAndCreate(shell)
  }))

  return [
    { id: 'new', label: t('menu.terminal.new'), shortcut: 'Ctrl+Shift+`', onClick: () => openAndCreate() },
    { id: 'split', label: t('menu.terminal.split'), shortcut: 'Ctrl+Shift+5', onClick: () => openAndCreate() },
    { id: 'rename', label: t('menu.terminal.rename'), onClick: renameActive },
    { id: 'sep-1', label: '', separator: true },
    { id: 'clear', label: t('menu.terminal.clear'), shortcut: 'Ctrl+K', onClick: clearActive },
    { id: 'kill', label: t('menu.terminal.kill'), onClick: killActive },
    { id: 'restart', label: t('menu.terminal.restart'), onClick: restartActive },
    { id: 'sep-2', label: '', separator: true },
    { id: 'copy-selection', label: t('menu.terminal.copySelection'), shortcut: 'Ctrl+Shift+C', onClick: copySelection },
    { id: 'paste', label: t('menu.terminal.paste'), shortcut: 'Ctrl+Shift+V', onClick: paste },
    { id: 'sep-3', label: '', separator: true },
    { id: 'settings', label: t('menu.terminal.settings'), submenu: shellSubmenu },
    { id: 'history', label: t('menu.terminal.history'), onClick: showHistory }
  ]
}
