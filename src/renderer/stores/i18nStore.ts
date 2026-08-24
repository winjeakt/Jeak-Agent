import { create } from 'zustand'
import type { AppLanguage, Theme } from '@shared/types'
import { messages, type MessageKey } from '../i18n/messages'
import { applyThemeToDom } from '../utils/theme'

interface I18nState {
  language: AppLanguage
  theme: Theme
  setLanguage: (lang: AppLanguage) => void
  setTheme: (theme: Theme) => void
  /** 翻译函数 */
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

/** 全局 i18n + 主题 store */
export const useI18nStore = create<I18nState>((set, get) => ({
  language: 'zh',
  theme: 'dark',

  setLanguage: (language) => set({ language }),
  setTheme: (theme) => {
    set({ theme })
    // 同步到 DOM（CSS 变量切换），system 会解析为实际明暗主题
    applyThemeToDom(theme)
  },

  t: (key, vars) => {
    const { language } = get()
    let text: string = messages[language][key] ?? messages.zh[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{${k}}`, String(v))
      }
    }
    return text
  }
}))

/** 便捷的翻译 hook：订阅 language 变化以触发重渲染 */
export function useT(): (key: MessageKey, vars?: Record<string, string | number>) => string {
  // 订阅 language，确保切换语言时组件重新渲染
  useI18nStore((s) => s.language)
  return useI18nStore.getState().t
}

export { messages }
