import { create } from 'zustand'

/** 设置面板的 tab */
export type SettingsTab = 'general' | 'ai' | 'shortcuts' | 'plugins'

/** 底部面板类型 */
export type BottomPanel = 'none' | 'diagnostics' | 'output'

/** 编辑器分组布局：1 / 2 / 3 栏 */
export type EditorLayout = 1 | 2 | 3

interface UIState {
  /** 设置面板是否打开 */
  showSettings: boolean
  /** 全局搜索框是否显示 */
  showSearch: boolean
  /** 设置面板要打开的 tab（null 表示保持默认 general） */
  settingsTab: SettingsTab | null
  /** 当前底部面板（调试 / 输出） */
  bottomPanel: BottomPanel
  /** 编辑器分组布局 */
  editorLayout: EditorLayout
  /** 打开设置（可指定 tab，供菜单栏跳转） */
  openSettings: (tab?: SettingsTab) => void
  closeSettings: () => void
  toggleSearch: () => void
  closeSearch: () => void
  /** 切换底部面板（再次点击同面板则关闭） */
  toggleBottomPanel: (panel: Exclude<BottomPanel, 'none'>) => void
  /** 设置编辑器分组布局 */
  setEditorLayout: (layout: EditorLayout) => void
}

/** 全局 UI 状态：设置面板、搜索框、底部面板、编辑器分组等 */
export const useUIStore = create<UIState>((set) => ({
  showSettings: false,
  showSearch: false,
  settingsTab: null,
  bottomPanel: 'none',
  editorLayout: 1,

  openSettings: (tab) => set({ showSettings: true, settingsTab: tab ?? null }),
  closeSettings: () => set({ showSettings: false, settingsTab: null }),
  toggleSearch: () => set((s) => ({ showSearch: !s.showSearch })),
  closeSearch: () => set({ showSearch: false }),
  toggleBottomPanel: (panel) => set((s) => ({ bottomPanel: s.bottomPanel === panel ? 'none' : panel })),
  setEditorLayout: (layout) => set({ editorLayout: layout })
}))
