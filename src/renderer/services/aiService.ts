import type { AIChatMessage, AIChatModel, AIChatRequest } from '@shared/types'
import { useEditorStore } from '../stores/editorStore'

/** 单次注入的最大文件内容长度 */
const MAX_FILE_CHARS = 8000

/* ==================== 上下文构建 ==================== */

/**
 * 构建系统提示词：定义 AI 助手的角色与行为规范。
 */
export function buildSystemPrompt(): string {
  return [
    '你是 Jeak Agent，一款本地化 AI 编程助手的内置智能体。',
    '你擅长代码解释、生成、重构、审查与调试，会结合编辑器上下文回答问题。',
    '回答使用简体中文，代码块标注语言，保持简洁准确。'
  ].join('\n')
}

/**
 * 构建当前工作区上下文：
 * 收集当前打开文件、语言及内容，注入到对话请求中。
 */
export function buildUserContext(): string {
  const { currentFile, language, content } = useEditorStore.getState()
  const truncated =
    content.length > MAX_FILE_CHARS
      ? `${content.slice(0, MAX_FILE_CHARS)}\n……（内容过长已截断）`
      : content

  return [
    '【当前工作区上下文】',
    `当前文件：${currentFile ?? '（未打开文件）'}`,
    `文件语言：${language}`,
    '文件内容：',
    `\`\`\`${language}`,
    truncated,
    '```'
  ].join('\n')
}

/**
 * 构造一次完整的对话请求（系统提示词 + 上下文 + 历史 + 提问）。
 */
export function buildChatRequest(params: {
  id: string
  messages: AIChatMessage[]
  model: AIChatModel
}): AIChatRequest {
  return { ...params }
}

/* ==================== IPC 通信封装 ==================== */

/** AI 流式事件订阅回调 */
export interface AIChatEvents {
  onDelta?: (payload: { id: string; delta: string }) => void
  onDone?: (payload: { id: string; aborted?: boolean }) => void
  onError?: (payload: { id: string; message: string }) => void
  onToolCall?: (payload: { id: string; name: string; argsJson: string }) => void
}

/**
 * 渲染进程侧 AI 服务：通过 preload 暴露的受限 IPC 与主进程通信。
 * 实际请求由主进程 AIService 发起，API Key 不经过渲染进程。
 */
export const aiService = {
  /** 发起流式对话 */
  chat: (request: AIChatRequest): void => {
    window.jeak.ai.chat(request)
  },

  /** 停止指定会话的流式响应 */
  stop: (id: string): void => {
    window.jeak.ai.stop(id)
  },

  /** 订阅流式事件，返回取消订阅函数 */
  subscribe: (events: AIChatEvents): (() => void) => {
    const unsubscribes: Array<() => void> = []
    if (events.onDelta) unsubscribes.push(window.jeak.ai.onDelta(events.onDelta))
    if (events.onDone) unsubscribes.push(window.jeak.ai.onDone(events.onDone))
    if (events.onError) unsubscribes.push(window.jeak.ai.onError(events.onError))
    if (events.onToolCall) unsubscribes.push(window.jeak.ai.onToolCall(events.onToolCall))
    return () => {
      unsubscribes.forEach((unsub) => unsub())
    }
  }
}
