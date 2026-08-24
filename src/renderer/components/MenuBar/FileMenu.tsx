import { useEffect, useState } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useT } from '../../stores/i18nStore'
import type { MenuItem } from './types'

/** "文件"菜单：新建 / 打开 / 保存 / 最近项目 / 退出 */
export function useFileMenuItems(): MenuItem[] {
  const t = useT()
  const currentFile = useEditorStore((s) => s.currentFile)
  const content = useEditorStore((s) => s.content)
  const language = useEditorStore((s) => s.language)
  const openFile = useEditorStore((s) => s.openFile)
  const newFile = useEditorStore((s) => s.newFile)
  const closeFile = useEditorStore((s) => s.closeFile)

  const [recentProjects, setRecentProjects] = useState<string[]>([])
  const [autoSave, setAutoSave] = useState(false)

  useEffect(() => {
    void window.jeak.recent.list().then(setRecentProjects)
    void window.jeak.settings.get().then((s) => setAutoSave(s.autoSave))
  }, [])

  const refreshRecent = async (): Promise<void> => {
    setRecentProjects(await window.jeak.recent.list())
  }

  const handleOpenFile = async (): Promise<void> => {
    const result = await window.jeak.file.open()
    if (result.canceled || !result.path) return
    openFile(result.path, result.content ?? '', result.language ?? 'plaintext')
    await refreshRecent()
  }

  const handleOpenFolder = async (): Promise<void> => {
    const result = await window.jeak.file.openFolder()
    if (result.canceled || !result.path) return
    await useWorkspaceStore.getState().loadTree(result.path)
    await refreshRecent()
  }

  const handleSave = async (): Promise<void> => {
    const result = await window.jeak.file.save(currentFile, content)
    // 另存为后路径变化，更新编辑器当前文件
    if (!result.canceled && result.path && result.path !== currentFile) {
      openFile(result.path, content, language)
    }
    await refreshRecent()
  }

  const handleSaveAs = async (): Promise<void> => {
    const result = await window.jeak.file.saveAs(content)
    if (!result.canceled && result.path) {
      openFile(result.path, content, language)
    }
    await refreshRecent()
  }

  /** 保存全部：单文件模型下等同于保存当前文件（未保存过则另存为） */
  const handleSaveAll = async (): Promise<void> => {
    if (!currentFile) {
      await handleSaveAs()
    } else {
      await handleSave()
    }
  }

  const toggleAutoSave = async (): Promise<void> => {
    const next = !autoSave
    setAutoSave(next)
    await window.jeak.settings.set({ autoSave: next })
  }

  const clearRecent = async (): Promise<void> => {
    setRecentProjects(await window.jeak.recent.clear())
  }

  /** 打开最近项目：自动判断是文件还是文件夹 */
  const handleOpenRecent = async (path: string): Promise<void> => {
    const result = await window.jeak.workspace.openPath(path)
    if (result.canceled || !result.path) return
    if (result.kind === 'file') {
      openFile(result.path, result.content ?? '', result.language ?? 'plaintext')
    } else {
      await useWorkspaceStore.getState().loadTree(result.path)
    }
    await refreshRecent()
  }

  const recentSubmenu: MenuItem[] = [
    ...(recentProjects.length > 0
      ? recentProjects.map((path, i) => ({
          id: `recent-${i}`,
          label: path,
          onClick: () => void handleOpenRecent(path)
        }))
      : [{ id: 'recent-empty', label: t('menu.file.recentEmpty'), disabled: true }]),
    { id: 'recent-sep', label: '', separator: true },
    { id: 'recent-clear', label: t('menu.file.clearRecent'), onClick: () => void clearRecent() }
  ]

  return [
    { id: 'new', label: t('menu.file.new'), shortcut: 'Ctrl+N', onClick: newFile },
    { id: 'open-file', label: t('menu.file.openFile'), shortcut: 'Ctrl+O', onClick: () => void handleOpenFile() },
    { id: 'open-folder', label: t('menu.file.openFolder'), onClick: () => void handleOpenFolder() },
    { id: 'sep-1', label: '', separator: true },
    { id: 'save', label: t('menu.file.save'), shortcut: 'Ctrl+S', onClick: () => void handleSave() },
    { id: 'save-as', label: t('menu.file.saveAs'), shortcut: 'Ctrl+Shift+S', onClick: () => void handleSaveAs() },
    { id: 'save-all', label: t('menu.file.saveAll'), shortcut: 'Ctrl+Alt+S', onClick: () => void handleSaveAll() },
    { id: 'sep-2', label: '', separator: true },
    { id: 'auto-save', label: t('menu.file.autoSave'), checked: autoSave, onClick: () => void toggleAutoSave() },
    { id: 'sep-3', label: '', separator: true },
    { id: 'recent', label: t('menu.file.recent'), submenu: recentSubmenu },
    { id: 'sep-4', label: '', separator: true },
    { id: 'close-editor', label: t('menu.file.closeEditor'), shortcut: 'Ctrl+F4', onClick: closeFile },
    { id: 'sep-5', label: '', separator: true },
    { id: 'exit', label: t('menu.file.exit'), shortcut: 'Ctrl+Q', danger: true, onClick: () => window.jeak.window.close() }
  ]
}
