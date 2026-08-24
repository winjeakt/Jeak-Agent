import { create } from 'zustand'
import type { LayoutSettings } from '@shared/types'

interface LayoutState {
  showFileTree: boolean
  showTerminal: boolean
  showChat: boolean
  setLayout: (patch: Partial<LayoutSettings>) => void
  toggle: (key: keyof LayoutSettings) => void
}

/** 界面布局 store：文件树 / 终端 / 对话面板的显示切换 */
export const useLayoutStore = create<LayoutState>((set, get) => ({
  showFileTree: true,
  showTerminal: false,
  showChat: true,

  setLayout: (patch) => set(patch),

  toggle: (key) => {
    const next = !get()[key]
    set({ [key]: next } as Partial<LayoutState>)
    // 持久化
    const { showFileTree, showTerminal, showChat } = get()
    void window.jeak.settings.set({
      layout: { showFileTree, showTerminal, showChat }
    })
  }
}))
