import type { Theme } from '@shared/types'

/**
 * 将三态主题解析为实际应用的明暗主题。
 * - 'dark' / 'light' 直接返回
 * - 'system' 根据操作系统偏好决定
 */
export function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

/** 将实际主题应用到 DOM（切换 CSS 变量） */
export function applyThemeToDom(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', resolveTheme(theme))
}
