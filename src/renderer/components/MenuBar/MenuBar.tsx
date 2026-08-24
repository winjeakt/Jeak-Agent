import { useEffect, useRef, useState } from 'react'
import MenuDropdown from './MenuDropdown'
import { useFileMenuItems } from './FileMenu'
import { useEditMenuItems } from './EditMenu'
import { useViewMenuItems } from './ViewMenu'
import { useTerminalMenuItems } from './TerminalMenu'
import { usePluginsMenuItems } from './PluginsMenu'
import { useHelpMenuItems } from './HelpMenu'
import { useT } from '../../stores/i18nStore'
import type { MenuItem } from './types'
import styles from './MenuBar.module.css'

interface MenuGroup {
  key: string
  title: string
  items: MenuItem[]
}

/** 完整顶部菜单栏：文件 / 编辑 / 视图 / 终端 / 插件 / 帮助 */
export default function MenuBar(): JSX.Element {
  const t = useT()
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const barRef = useRef<HTMLElement | null>(null)

  const fileItems = useFileMenuItems()
  const editItems = useEditMenuItems()
  const viewItems = useViewMenuItems()
  const terminalItems = useTerminalMenuItems()
  const pluginsItems = usePluginsMenuItems()
  const helpItems = useHelpMenuItems()

  const menus: MenuGroup[] = [
    { key: 'file', title: t('menu.file'), items: fileItems },
    { key: 'edit', title: t('menu.edit'), items: editItems },
    { key: 'view', title: t('menu.view'), items: viewItems },
    { key: 'terminal', title: t('menu.terminal'), items: terminalItems },
    { key: 'plugins', title: t('menu.plugins'), items: pluginsItems },
    { key: 'help', title: t('menu.help'), items: helpItems }
  ]

  // 点击菜单栏外部时关闭所有菜单
  useEffect(() => {
    if (!activeMenu) return
    const handlePointerDown = (e: MouseEvent): void => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActiveMenu(null)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [activeMenu])

  return (
    <nav className={styles.menubar} ref={barRef}>
      {menus.map((menu) => {
        const isOpen = activeMenu === menu.key
        return (
          <div
            key={menu.key}
            className={styles.menuGroup}
            onMouseEnter={() => {
              // 已有菜单展开时，悬停其他菜单直接切换（下拉菜单常见交互）
              if (activeMenu && activeMenu !== menu.key) setActiveMenu(menu.key)
            }}
          >
            <button
              className={`${styles.menuButton}${isOpen ? ` ${styles.menuButtonActive}` : ''}`}
              onClick={() => setActiveMenu(isOpen ? null : menu.key)}
              aria-haspopup="menu"
              aria-expanded={isOpen}
            >
              {menu.title}
            </button>
            {isOpen && <MenuDropdown items={menu.items} onClose={() => setActiveMenu(null)} />}
          </div>
        )
      })}
    </nav>
  )
}
