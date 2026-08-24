import { useEffect, useRef, useState } from 'react'
import type { AIChatModel } from '@shared/types'
import { useChatStore } from '../../stores/chatStore'
import type { ChatMessage } from '../../stores/chatStore'
import ChatSettings from './ChatSettings'

function MessageItem({ message }: { message: ChatMessage }): JSX.Element {
  const isUser = message.role === 'user'
  return (
    <div className={`chat-msg chat-msg--${isUser ? 'user' : 'assistant'}`}>
      <div className="chat-msg__role">{isUser ? '你' : 'Jeak'}</div>
      <div className="chat-msg__body">
        <pre
          className={`chat-msg__content${message.streaming ? ' chat-msg__content--streaming' : ''}`}
        >
          {message.content || (message.streaming ? '正在思考…' : '')}
        </pre>
        {message.error && <div className="chat-msg__error">{message.error}</div>}
      </div>
    </div>
  )
}

const MODEL_OPTIONS: Array<{ value: AIChatModel; label: string }> = [
  { value: 'deepseek-chat', label: 'deepseek-chat' },
  { value: 'deepseek-reasoner', label: 'deepseek-reasoner' }
]

export default function ChatPanel(): JSX.Element {
  const messages = useChatStore((s) => s.messages)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const model = useChatStore((s) => s.model)
  const hasApiKey = useChatStore((s) => s.hasApiKey)
  const setModel = useChatStore((s) => s.setModel)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const stopStreaming = useChatStore((s) => s.stopStreaming)
  const clearMessages = useChatStore((s) => s.clearMessages)

  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // 新消息时自动滚动到底部
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  // 初始化时读取设置，判断是否已配置 API Key
  useEffect(() => {
    window.jeak.settings.get().then((settings) => {
      setModel(settings.ai.model)
      useChatStore.getState().setHasApiKey(Boolean(settings.ai.apiKey))
    })
  }, [setModel])

  const handleSend = (): void => {
    if (!input.trim() || isStreaming) return
    sendMessage(input)
    setInput('')
  }

  return (
    <div className="panel">
      <div className="panel__header">
        <span>AI 对话</span>
        <div className="chat-header__actions">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as AIChatModel)}
            title="选择模型"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button onClick={() => setShowSettings(true)} title="设置">
            ⚙
          </button>
          <button onClick={clearMessages} title="清空对话">
            🗑
          </button>
        </div>
      </div>

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="empty-placeholder">
            <div className="empty-placeholder__icon">💬</div>
            <div>{hasApiKey ? '开始和 AI 对话' : '请先配置 API Key'}</div>
            <div style={{ fontSize: 12 }}>将自动携带当前文件内容作为上下文</div>
          </div>
        )}
        {messages.map((m) => (
          <MessageItem key={m.id} message={m} />
        ))}
      </div>

      <div className="chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
        />
        <div className="chat-input__actions">
          <span className="chat-input__hint">{hasApiKey ? '' : '⚠ 未配置 API Key'}</span>
          {isStreaming ? (
            <button className="chat-input__stop" onClick={stopStreaming}>
              停止
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim()}>
              发送
            </button>
          )}
        </div>
      </div>

      {showSettings && <ChatSettings onClose={() => setShowSettings(false)} />}
    </div>
  )
}
