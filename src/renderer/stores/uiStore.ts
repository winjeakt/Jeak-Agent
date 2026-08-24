import { create } from 'zustand'

/** 设置面板的 tab */
export type SettingsTab = 'general' | 'ai' | 'shortcuts' | 'plugins'

interface UIState {
  /** 设置面板是否打开 */
  showSettings: boolean
  /** 全局搜索框是否显示 */
  showSearch: boolean
  /** 设置面板要打开的 tab（null 表示保持默认 general） */
  settingsTab: SettingsTab | null
  /** 打开设置（可指定 tab，供菜单栏跳转） */
  openSettings: (tab?: SettingsTab) => void
  closeSettings: () => void
  toggleSearch: () => void
  closeSearch: () => void
}

/** 全局 UI 状态：设置面板、搜索框等（供标题栏 / 菜单栏等全局组件控制） */
export const useUIStore = create<UIState>((set) => ({
  showSettings: false,
  showSearch: false,
  settingsTab: null,

  openSettings: (tab) => set({ showSettings: true, settingsTab: tab ?? null }),
  closeSettings: () => set({ showSettings: false, settingsTab: null }),
  toggleSearch: () => set((s) => ({ showSearch: !s.showSearch })),
  closeSearch: () => set({ showSearch: false })
}))
