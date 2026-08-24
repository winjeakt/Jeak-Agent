import { useState } from 'react'
import type { MenuItem } from './types'
import styles from './MenuBar.module.css'

interface MenuDropdownProps {
  items: MenuItem[]
  /** 任意菜单项触发后关闭整个菜单 */
  onClose: () => void
}

/** 下拉面板：毛玻璃 + 阴影，递归渲染菜单项与子菜单 */
export default function MenuDropdown({ items, onClose }: MenuDropdownProps): JSX.Element {
  return (
    <div className={styles.dropdown} role="menu">
      {items.map((item) => (
        <MenuItemRow key={item.id} item={item} onClose={onClose} />
      ))}
    </div>
  )
}

function MenuItemRow({
  item,
  onClose
}: {
  item: MenuItem
  onClose: () => void
}): JSX.Element {
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const hasSubmenu = Boolean(item.submenu && item.submenu.length > 0)

  if (item.separator) {
    return <div className={styles.separator} role="separator" />
  }

  const handleClick = (): void => {
    if (item.disabled) return
    if (hasSubmenu) return // 子菜单通过 hover 展开，点击不关闭
    item.onClick?.()
    onClose()
  }

  const classNames = [
    styles.item,
    item.disabled ? styles.itemDisabled : '',
    item.danger ? styles.itemDanger : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classNames}
      role="menuitem"
      aria-disabled={item.disabled}
      onMouseEnter={() => {
        if (hasSubmenu) setSubmenuOpen(true)
      }}
      onMouseLeave={() => {
        if (hasSubmenu) setSubmenuOpen(false)
      }}
      onClick={handleClick}
    >
      <span className={styles.check}>{item.checked ? '✓' : ''}</span>
      <span className={styles.label}>{item.label}</span>
      {item.shortcut && <kbd className={styles.kbd}>{item.shortcut}</kbd>}
      {hasSubmenu && <span className={styles.arrow}>›</span>}
      {hasSubmenu && submenuOpen && (
        <div className={styles.submenu} role="menu">
          {item.submenu!.map((sub) => (
            <MenuItemRow key={sub.id} item={sub} onClose={onClose} />
          ))}
        </div>
      )}
    </div>
  )
}
