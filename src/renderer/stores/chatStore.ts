import { create } from 'zustand'
import type { AIChatMessage, AIChatModel } from '@shared/types'
import { aiService, buildChatRequest, buildSystemPrompt, buildUserContext } from '../services/aiService'

/** 渲染进程侧的对话消息（含流式/错误状态） */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  streaming?: boolean
  error?: string
  /** 当前正在调用的 MCP 工具名（function calling 展示） */
  toolCall?: string
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  model: AIChatModel
  hasApiKey: boolean
  setModel: (model: AIChatModel) => void
  setHasApiKey: (has: boolean) => void
  clearMessages: () => void
  sendMessage: (content: string) => void
  stopStreaming: () => void
}

let listenersBound = false

/**
 * 绑定流式事件监听（仅执行一次）。
 * delta 追加到对应 assistant 消息；done/error 结束流式状态。
 */
function ensureListeners(): void {
  if (listenersBound || typeof window === 'undefined' || !window.jeak) return
  listenersBound = true

  aiService.subscribe({
    onDelta: ({ id, delta }) => {
      useChatStore.setState((s) => ({
        messages: s.messages.map((m) =>
          m.id === id ? { ...m, content: m.content + delta, toolCall: undefined } : m
        )
      }))
    },
    onDone: ({ id }) => {
      useChatStore.setState((s) => ({
        isStreaming: false,
        messages: s.messages.map((m) =>
          m.id === id ? { ...m, streaming: false, toolCall: undefined } : m
        )
      }))
    },
    onError: ({ id, message }) => {
      useChatStore.setState((s) => ({
        isStreaming: false,
        messages: s.messages.map((m) => (m.id === id ? { ...m, streaming: false, error: message } : m))
      }))
    },
    onToolCall: ({ id, name }) => {
      useChatStore.setState((s) => ({
        messages: s.messages.map((m) => (m.id === id ? { ...m, toolCall: name } : m))
      }))
    }
  })
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  model: 'deepseek-chat',
  hasApiKey: false,

  setModel: (model) => set({ model }),
  setHasApiKey: (has) => set({ hasApiKey: has }),

  clearMessages: () => set({ messages: [] }),

  stopStreaming: () => {
    const { messages, isStreaming } = get()
    if (!isStreaming) return
    const streamingMsg = [...messages].reverse().find((m) => m.streaming)
    if (streamingMsg) {
      aiService.stop(streamingMsg.id)
    }
  },

  sendMessage: (content) => {
    const text = content.trim()
    if (!text || get().isStreaming) return
    ensureListeners()

    const id = genId()
    const { model, messages } = get()

    // 先追加用户消息 + 空的 assistant 消息（流式填充）
    set((s) => ({
      isStreaming: true,
      messages: [
        ...s.messages,
        { id: genId(), role: 'user', content: text, timestamp: Date.now() },
        { id, role: 'assistant', content: '', timestamp: Date.now(), streaming: true }
      ]
    }))

    // 构建完整请求：系统提示词 + 当前上下文 + 最近对话历史 + 本次提问
    const system = `${buildSystemPrompt()}\n\n${buildUserContext()}`
    const history = messages
      .filter((m) => !m.streaming && !m.error)
      .slice(-10)
      .map((m): AIChatMessage => ({ role: m.role, content: m.content }))

    aiService.chat(
      buildChatRequest({
        id,
        messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: text }],
        model
      })
    )
  }
}))
