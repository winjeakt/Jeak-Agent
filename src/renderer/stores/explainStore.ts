import { create } from 'zustand'
import type { AIChatMessage, EditorLanguage } from '@shared/types'
import { aiService, buildSystemPrompt } from '../services/aiService'
import { useChatStore } from './chatStore'

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Ctrl+E 代码解释浮层的状态 */
interface ExplainState {
  visible: boolean
  /** 被解释的代码 */
  code: string
  /** 代码语言 */
  language: EditorLanguage
  /** AI 解释内容（流式追加） */
  content: string
  streaming: boolean
  error?: string
  /** 当前请求 ID（用于过滤事件） */
  _requestId: string | null
  open: (code: string, language: EditorLanguage) => void
  close: () => void
}

let listenersBound = false

/** 绑定流式事件（独立于对话面板，按请求 ID 过滤） */
function ensureListeners(): void {
  if (listenersBound || typeof window === 'undefined' || !window.jeak) return
  listenersBound = true

  aiService.subscribe({
    onDelta: ({ id, delta }) => {
      useExplainStore.setState((s) => (s._requestId === id ? { content: s.content + delta } : s))
    },
    onDone: ({ id }) => {
      useExplainStore.setState((s) => (s._requestId === id ? { streaming: false } : s))
    },
    onError: ({ id, message }) => {
      useExplainStore.setState((s) =>
        s._requestId === id ? { streaming: false, error: message } : s
      )
    }
  })
}

export const useExplainStore = create<ExplainState>((set, get) => ({
  visible: false,
  code: '',
  language: 'plaintext',
  content: '',
  streaming: false,
  error: undefined,
  _requestId: null,

  /** 打开解释浮层并立即发起流式解释请求 */
  open: (code, language) => {
    if (get().streaming) return
    ensureListeners()

    const id = genId()
    const model = useChatStore.getState().model
    set({
      visible: true,
      code,
      language,
      content: '',
      streaming: true,
      error: undefined,
      _requestId: id
    })

    const messages: AIChatMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content:
          `请解释下面这段 ${language} 代码的作用、实现思路和关键点，` +
          '使用简体中文回答：\n' +
          `\`\`\`${language}\n${code}\n\`\`\``
      }
    ]
    aiService.chat({ id, messages, model })
  },

  /** 关闭浮层（若有进行中的流，先停止） */
  close: () => {
    const { _requestId, streaming } = get()
    if (streaming && _requestId) aiService.stop(_requestId)
    set({ visible: false, _requestId: null })
  }
}))
