import { create } from 'zustand'

export type OutputKind = 'info' | 'ai' | 'system' | 'error'

export interface OutputLine {
  id: number
  time: string
  kind: OutputKind
  text: string
}

let nextId = 1

interface OutputState {
  lines: OutputLine[]
  /** 追加一条输出（最多保留最近 200 条） */
  append: (kind: OutputKind, text: string) => void
  clear: () => void
}

/** 底部"输出"面板：汇集系统 / AI / 插件等运行日志 */
export const useOutputStore = create<OutputState>((set) => ({
  lines: [],
  append: (kind, text) => {
    const time = new Date().toLocaleTimeString()
    set((s) => ({ lines: [...s.lines, { id: nextId++, time, kind, text }].slice(-200) }))
  },
  clear: () => set({ lines: [] })
}))
