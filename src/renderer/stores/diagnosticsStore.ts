import { create } from 'zustand'
import type { Diagnostic } from '@shared/types'

interface DiagnosticsState {
  /** 当前问题列表（来自插件 lint 等） */
  diagnostics: Diagnostic[]
  /** 设置问题列表 */
  setDiagnostics: (diagnostics: Diagnostic[]) => void
  /** 清空 */
  clear: () => void
}

/** 编辑器问题列表（由插件 show-diagnostics 触发，Markers + 底部面板展示） */
export const useDiagnosticsStore = create<DiagnosticsState>((set) => ({
  diagnostics: [],
  setDiagnostics: (diagnostics) => set({ diagnostics }),
  clear: () => set({ diagnostics: [] })
}))
