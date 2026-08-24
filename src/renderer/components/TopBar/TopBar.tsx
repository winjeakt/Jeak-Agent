import { MenuBar } from '../MenuBar'
import WindowControls from './WindowControls'
import { useUIStore } from '../../stores/uiStore'
import { useT } from '../../stores/i18nStore'
import styles from './TopBar.module.css'

/** CodeBuddy 风格标题栏：左标识 / 中菜单 / 右操作与窗口控制 */
export default function TopBar(): JSX.Element {
  const t = useT()
  const openSettings = useUIStore((s) => s.openSettings)
  const toggleSearch = useUIStore((s) => s.toggleSearch)

  return (
    <div className={styles.topBar}>
      {/* 左侧：应用标识 */}
      <div className={styles.left}>
        <span className={styles.logo}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="1" y="1" width="14" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 11 L4 8 L5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 5 L10 8 L9 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className={styles.projectName}>Jeak Studio</span>
      </div>

      {/* 中间：完整功能菜单 */}
      <div className={styles.center}>
        <MenuBar />
      </div>

      {/* 右侧：搜索 / 设置 / 窗口控制 */}
      <div className={styles.right}>
        <button className={styles.actionButton} onClick={toggleSearch} title={t('menu.search')}>
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <line x1="11" y1="11" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <button className={styles.actionButton} onClick={() => openSettings()} title={t('chat.settings')}>
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M8 1 L9.2 3.4 L12 4 L10.8 6 L11 9 L8.5 10 L6 9 L5.2 6 L4 4 L6.8 3.4 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </button>
        <WindowControls />
      </div>
    </div>
  )
}
