import { useT } from '../../stores/i18nStore'
import { useUIStore } from '../../stores/uiStore'
import { executeEditorCommand } from './editorCommands'
import type { MenuItem } from './types'

/** "编辑"菜单：撤销 / 剪贴板 / 查找 / 代码智能操作 */
export function useEditMenuItems(): MenuItem[] {
  const t = useT()
  const toggleSearch = useUIStore((s) => s.toggleSearch)
  const cmd = (command: string) => (): void => executeEditorCommand(command)

  return [
    { id: 'undo', label: t('menu.edit.undo'), shortcut: 'Ctrl+Z', onClick: cmd('undo') },
    { id: 'redo', label: t('menu.edit.redo'), shortcut: 'Ctrl+Y', onClick: cmd('redo') },
    { id: 'sep-1', label: '', separator: true },
    { id: 'cut', label: t('menu.edit.cut'), shortcut: 'Ctrl+X', onClick: cmd('cut') },
    { id: 'copy', label: t('menu.edit.copy'), shortcut: 'Ctrl+C', onClick: cmd('copy') },
    { id: 'paste', label: t('menu.edit.paste'), shortcut: 'Ctrl+V', onClick: cmd('paste') },
    { id: 'sep-2', label: '', separator: true },
    { id: 'find', label: t('menu.edit.find'), shortcut: 'Ctrl+F', onClick: cmd('find') },
    { id: 'replace', label: t('menu.edit.replace'), shortcut: 'Ctrl+H', onClick: cmd('replace') },
    { id: 'find-in-files', label: t('menu.edit.findInFiles'), shortcut: 'Ctrl+Shift+F', onClick: toggleSearch },
    { id: 'sep-3', label: '', separator: true },
    { id: 'select-all', label: t('menu.edit.selectAll'), shortcut: 'Ctrl+A', onClick: cmd('selectAll') },
    { id: 'sep-4', label: '', separator: true },
    { id: 'format', label: t('menu.edit.format'), shortcut: 'Shift+Alt+F', onClick: cmd('format') },
    { id: 'toggle-comment', label: t('menu.edit.toggleComment'), shortcut: 'Ctrl+/', onClick: cmd('toggleComment') },
    { id: 'sep-5', label: '', separator: true },
    { id: 'goto-def', label: t('menu.edit.gotoDefinition'), shortcut: 'F12', onClick: cmd('gotoDefinition') },
    { id: 'find-refs', label: t('menu.edit.findReferences'), shortcut: 'Shift+F12', onClick: cmd('findReferences') },
    { id: 'suggest', label: t('menu.edit.suggest'), shortcut: 'Ctrl+Space', onClick: cmd('suggest') },
    { id: 'quick-fix', label: t('menu.edit.quickFix'), shortcut: 'Ctrl+.', onClick: cmd('quickFix') }
  ]
}
