import { create } from 'zustand'
import type { ShellKind } from '@shared/types'

export interface TerminalLine {
  kind: 'stdout' | 'stderr' | 'system'
  text: string
}

export interface TerminalSessionState {
  id: string
  name: string
  shell: ShellKind
  started: boolean
  lines: TerminalLine[]
  input: string
  history: string[]
  historyIndex: number
}

let sessionSeq = 0
function makeId(): string {
  sessionSeq += 1
  return `term-${sessionSeq}-${Date.now().toString(36)}`
}

interface TerminalState {
  sessions: TerminalSessionState[]
  activeId: string | null
  /** 新建会话（返回 id） */
  createSession: (shell?: ShellKind) => string
  /** 关闭会话（终止进程并移除） */
  closeSession: (id: string) => void
  /** 重命名会话 */
  renameSession: (id: string, name: string) => void
  /** 切换活动会话 */
  setActive: (id: string) => void
  /** 启动会话的 shell 进程 */
  start: (id: string) => void
  /** 写入命令（记录历史） */
  write: (id: string, input: string) => void
  /** 终止会话进程（保留会话） */
  dispose: (id: string) => void
  /** 终止所有会话进程（面板卸载时） */
  disposeAll: () => void
  /** 追加输出 */
  appendOutput: (id: string, kind: 'stdout' | 'stderr' | 'system', data: string) => void
  setInput: (id: string, input: string) => void
  clear: (id: string) => void
  historyUp: (id: string) => void
  historyDown: (id: string) => void
}

/** 终端状态：多会话 + 命令历史 */
export const useTerminalStore = create<TerminalState>((set, get) => {
  const updateSession = (id: string, patch: Partial<TerminalSessionState>): void => {
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, ...patch } : sess))
    }))
  }

  return {
    sessions: [],
    activeId: null,

    createSession: (shell = 'powershell') => {
      const id = makeId()
      const session: TerminalSessionState = {
        id,
        name: id,
        shell,
        started: false,
        lines: [],
        input: '',
        history: [],
        historyIndex: -1
      }
      set((s) => ({ sessions: [...s.sessions, session], activeId: id }))
      return id
    },

    closeSession: (id) => {
      get().dispose(id)
      set((s) => {
        const sessions = s.sessions.filter((sess) => sess.id !== id)
        const activeId = s.activeId === id ? (sessions[sessions.length - 1]?.id ?? null) : s.activeId
        return { sessions, activeId }
      })
    },

    renameSession: (id, name) => {
      if (name.trim()) updateSession(id, { name: name.trim() })
    },

    setActive: (id) => set({ activeId: id }),

    start: (id) => {
      const session = get().sessions.find((s) => s.id === id)
      if (!session || session.started) return
      window.jeak.terminal.start(id, session.shell)
      updateSession(id, { started: true })
    },

    write: (id, input) => {
      const session = get().sessions.find((s) => s.id === id)
      if (!session) return
      if (!session.started) get().start(id)
      window.jeak.terminal.write(id, input)
      const cmd = input.replace(/[\r\n]+$/, '')
      if (cmd.trim()) {
        updateSession(id, { history: [...session.history, cmd].slice(-100), historyIndex: -1 })
      }
    },

    dispose: (id) => {
      window.jeak.terminal.dispose(id)
      updateSession(id, { started: false })
    },

    disposeAll: () => {
      for (const s of get().sessions) {
        window.jeak.terminal.dispose(s.id)
      }
      set((state) => ({ sessions: state.sessions.map((s) => ({ ...s, started: false })) }))
    },

    appendOutput: (id, kind, data) => {
      const session = get().sessions.find((s) => s.id === id)
      if (!session) return
      const current = session.lines
      const last = current[current.length - 1]
      const parts = data.split('\r\n')
      if (
        last &&
        last.kind === kind &&
        parts.length > 0 &&
        !data.startsWith('\r\n') &&
        last.text !== '' &&
        !last.text.endsWith('\n')
      ) {
        const merged = [...current]
        merged[merged.length - 1] = { kind, text: last.text + parts[0] }
        for (let i = 1; i < parts.length; i++) merged.push({ kind, text: parts[i] })
        updateSession(id, { lines: merged })
        return
      }
      updateSession(id, { lines: [...current, ...parts.map((text) => ({ kind, text }))] })
    },

    setInput: (id, input) => updateSession(id, { input }),

    clear: (id) => updateSession(id, { lines: [] }),

    historyUp: (id) => {
      const session = get().sessions.find((s) => s.id === id)
      if (!session || session.history.length === 0) return
      const idx =
        session.historyIndex < 0 ? session.history.length - 1 : Math.max(0, session.historyIndex - 1)
      updateSession(id, { historyIndex: idx, input: session.history[idx] })
    },

    historyDown: (id) => {
      const session = get().sessions.find((s) => s.id === id)
      if (!session || session.historyIndex < 0) return
      const idx = session.historyIndex + 1
      if (idx >= session.history.length) {
        updateSession(id, { historyIndex: -1, input: '' })
      } else {
        updateSession(id, { historyIndex: idx, input: session.history[idx] })
      }
    }
  }
})
