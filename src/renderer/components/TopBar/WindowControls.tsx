import styles from './TopBar.module.css'

/** 窗口控制按钮：最小化 / 最大化 / 关闭 */
export default function WindowControls(): JSX.Element {
  return (
    <div className={styles.windowControls}>
      <button
        className={styles.windowButton}
        onClick={() => window.jeak.window.minimize()}
        title="最小化"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button
        className={styles.windowButton}
        onClick={() => window.jeak.window.toggleMaximize()}
        title="最大化"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button
        className={`${styles.windowButton} ${styles.windowClose}`}
        onClick={() => window.jeak.window.close()}
        title="关闭"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1" />
          <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  )
}
