import { create } from 'zustand'
import type { Theme } from '@shared/types'

interface ThemeState {
  theme: Theme
  /** 设置主题（同步 DOM 变量 + 持久化 + 同步 i18nStore） */
  setTheme: (theme: Theme) => void
  /** 切换主题 */
  toggleTheme: () => void
}

/**
 * 主题 store（Phase 6 标题栏使用）。
 * 与 i18nStore 的 theme 字段保持一致，切换时：
 * 1. 更新自身状态
 * 2. 设置 DOM 的 data-theme 属性（CSS 变量切换）
 * 3. 持久化到 electron-store
 * 4. 同步 i18nStore（避免两处状态漂移）
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',

  setTheme: (theme) => {
    set({ theme })
    document.documentElement.setAttribute('data-theme', theme)
    // 同步 i18nStore 的 theme（延迟导入避免循环依赖）
    void import('./i18nStore').then(({ useI18nStore }) => {
      useI18nStore.getState().setTheme(theme)
    })
    void window.jeak.settings.set({ theme })
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  }
}))
