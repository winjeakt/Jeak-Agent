import { create } from 'zustand'

export interface TerminalLine {
  kind: 'stdout' | 'stderr' | 'system'
  text: string
}

interface TerminalState {
  /** 是否已启动 shell */
  started: boolean
  /** 输出行列表 */
  lines: TerminalLine[]
  /** 当前输入 */
  input: string
  start: () => void
  write: (input: string) => void
  dispose: () => void
  /** 追加输出 */
  appendOutput: (kind: 'stdout' | 'stderr' | 'system', data: string) => void
  setInput: (input: string) => void
  clear: () => void
}

/** 终端 store：管理 shell 输出与输入 */
export const useTerminalStore = create<TerminalState>((set, get) => ({
  started: false,
  lines: [],
  input: '',

  start: () => {
    if (get().started) return
    window.jeak.terminal.start()
    set({ started: true })
  },

  write: (input) => {
    if (!get().started) get().start()
    window.jeak.terminal.write(input)
  },

  dispose: () => {
    window.jeak.terminal.dispose()
    set({ started: false })
  },

  appendOutput: (kind, data) => {
    // 按换行拆分，保持显示友好
    const current = get().lines
    const last = current[current.length - 1]
    const parts = data.split('\r\n')
    // 若上一行是 stdout/stderr 且未以换行结束，则合并到最后一行
    if (last && last.kind === kind && parts.length > 0 && !data.startsWith('\r\n') && last.text !== '' && !last.text.endsWith('\n')) {
      const merged = [...current]
      merged[merged.length - 1] = { kind, text: last.text + parts[0] }
      for (let i = 1; i < parts.length; i++) merged.push({ kind, text: parts[i] })
      set({ lines: merged })
      return
    }
    set({ lines: [...current, ...parts.map((text) => ({ kind, text }))] })
  },

  setInput: (input) => set({ input }),

  clear: () => set({ lines: [] })
}))
