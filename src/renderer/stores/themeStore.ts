import { create } from 'zustand'
import type { Theme } from '@shared/types'
import { applyThemeToDom, resolveTheme } from '../utils/theme'
import { useI18nStore } from './i18nStore'

interface ThemeState {
  /** 用户选择的主题（dark / light / system） */
  theme: Theme
  /** 实际应用的明暗主题（system 解析后的结果，供 Monaco 等使用） */
  resolvedTheme: 'dark' | 'light'
  /** 设置主题（同步 DOM 变量 + 持久化 + 同步 i18nStore） */
  setTheme: (theme: Theme) => void
  /** 在明暗之间切换 */
  toggleTheme: () => void
}

/**
 * 主题 store（标题栏 / 菜单栏使用）。
 * 与 i18nStore 的 theme 字段保持一致，切换时：
 * 1. 更新自身状态（theme + resolvedTheme）
 * 2. 设置 DOM 的 data-theme 属性（CSS 变量切换）
 * 3. 持久化到 electron-store
 * 4. 同步 i18nStore（避免两处状态漂移）
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',
  resolvedTheme: 'dark',

  setTheme: (theme) => {
    set({ theme, resolvedTheme: resolveTheme(theme) })
    applyThemeToDom(theme)
    // 同步 i18nStore 的 theme（i18nStore 不依赖 themeStore，无循环依赖）
    useI18nStore.getState().setTheme(theme)
    void window.jeak.settings.set({ theme })
  },

  toggleTheme: () => {
    const next = get().resolvedTheme === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  }
}))

// 跟随系统：监听操作系统明暗偏好变化，自动刷新实际主题
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme } = useThemeStore.getState()
    if (theme === 'system') {
      useThemeStore.getState().setTheme('system')
    }
  })
}
