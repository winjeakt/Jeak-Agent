import { create } from 'zustand'

interface UIState {
  /** 设置面板是否打开 */
  showSettings: boolean
  /** 全局搜索框是否显示 */
  showSearch: boolean
  openSettings: () => void
  closeSettings: () => void
  toggleSearch: () => void
  closeSearch: () => void
}

/** 全局 UI 状态：设置面板、搜索框等（供标题栏等全局组件控制） */
export const useUIStore = create<UIState>((set) => ({
  showSettings: false,
  showSearch: false,

  openSettings: () => set({ showSettings: true }),
  closeSettings: () => set({ showSettings: false }),
  toggleSearch: () => set((s) => ({ showSearch: !s.showSearch })),
  closeSearch: () => set({ showSearch: false })
}))
