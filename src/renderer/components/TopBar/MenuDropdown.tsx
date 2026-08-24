import { useDropdown } from './useDropdown'
import styles from './TopBar.module.css'

export interface MenuItem {
  label: string
  /** 快捷键提示（显示在右侧） */
  shortcut?: string
  /** 分隔线（置为 true 表示该项上方有分隔线） */
  separator?: boolean
  /** 点击回调 */
  onClick?: () => void
}

interface MenuDropdownProps {
  title: string
  items: MenuItem[]
  /** 受控展开状态（由父组件协调"一次只开一个菜单"） */
  open: boolean
  onToggle: () => void
  onClose: () => void
}

/** 标题栏下拉菜单面板（毛玻璃效果），使用 useDropdown 管理外部点击关闭 */
export default function MenuDropdown({
  title,
  items,
  open,
  onToggle,
  onClose
}: MenuDropdownProps): JSX.Element {
  const dropdown = useDropdown({ open, onOutsideClose: onClose })
  // 当外部点击触发关闭时，同步父组件状态
  const handleToggle = (): void => {
    if (open) {
      onClose()
    } else {
      onToggle()
    }
  }

  return (
    <div className={styles.menuWrapper} ref={dropdown.ref}>
      <button
        className={`${styles.menuButton}${open ? ` ${styles.menuButtonActive}` : ''}`}
        onClick={handleToggle}
      >
        {title}
      </button>
      {open && (
        <div className={styles.dropdown}>
          {items.map((item, index) => (
            <div key={`${item.label}-${index}`}>
              {item.separator && <div className={styles.dropdownSeparator} />}
              <button
                className={styles.dropdownItem}
                onClick={() => {
                  item.onClick?.()
                  onClose()
                }}
              >
                <span className={styles.dropdownLabel}>{item.label}</span>
                {item.shortcut && <span className={styles.dropdownShortcut}>{item.shortcut}</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
