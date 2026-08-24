import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useT } from '../../stores/i18nStore'
import styles from './TopBar.module.css'

/** 全局搜索框（UI 展示，功能暂留空） */
export default function SearchBox(): JSX.Element | null {
  const showSearch = useUIStore((s) => s.showSearch)
  const closeSearch = useUIStore((s) => s.closeSearch)
  const t = useT()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showSearch) {
      inputRef.current?.focus()
    }
  }, [showSearch])

  if (!showSearch) return null

  return (
    <div className={styles.searchOverlay} onClick={closeSearch}>
      <div className={styles.searchBox} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('menu.search') + '…'}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeSearch()
          }}
        />
        <button className={styles.searchClose} onClick={closeSearch}>
          ✕
        </button>
      </div>
    </div>
  )
}
