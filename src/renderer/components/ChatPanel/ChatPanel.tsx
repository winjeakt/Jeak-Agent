import { useEffect, useRef, useState } from 'react'
import type { AIChatModel } from '@shared/types'
import { useChatStore } from '../../stores/chatStore'
import type { ChatMessage } from '../../stores/chatStore'
import { useT } from '../../stores/i18nStore'
import { useUIStore } from '../../stores/uiStore'
import { MODEL_OPTIONS } from '../../constants/models'

function MessageItem({ message }: { message: ChatMessage }): JSX.Element {
  const t = useT()
  const isUser = message.role === 'user'
  return (
    <div className={`chat-msg chat-msg--${isUser ? 'user' : 'assistant'}`}>
      <div className="chat-msg__role">{isUser ? t('chat.you') : 'Jeak'}</div>
      <div className="chat-msg__body">
        <pre
          className={`chat-msg__content${message.streaming ? ' chat-msg__content--streaming' : ''}`}
        >
          {message.content || (message.streaming ? t('chat.thinking') : '')}
        </pre>
        {message.error && <div className="chat-msg__error">{message.error}</div>}
      </div>
    </div>
  )
}



export default function ChatPanel(): JSX.Element {
  const t = useT()
  const messages = useChatStore((s) => s.messages)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const model = useChatStore((s) => s.model)
  const hasApiKey = useChatStore((s) => s.hasApiKey)
  const setModel = useChatStore((s) => s.setModel)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const stopStreaming = useChatStore((s) => s.stopStreaming)
  const clearMessages = useChatStore((s) => s.clearMessages)

  const [input, setInput] = useState('')
  const [sendShortcut, setSendShortcut] = useState('Enter')
  const openSettings = useUIStore((s) => s.openSettings)
  const listRef = useRef<HTMLDivElement>(null)

  // 新消息时自动滚动到底部
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  // 初始化时读取设置，判断是否已配置 API Key + 快捷键
  useEffect(() => {
    window.jeak.settings.get().then((settings) => {
      setModel(settings.ai.model)
      setSendShortcut(settings.shortcuts?.send ?? 'Enter')
      useChatStore.getState().setHasApiKey(Boolean(settings.ai.apiKey))
    })
  }, [setModel])

  const handleSend = (): void => {
    if (!input.trim() || isStreaming) return
    sendMessage(input)
    setInput('')
  }

  // 判断快捷键是否匹配（支持自定义组合键）
  const matchesSendShortcut = (e: React.KeyboardEvent): boolean => {
    if (sendShortcut === 'Enter') {
      return e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing
    }
    const parts = sendShortcut.split('+')
    const key = parts[parts.length - 1]
    const wantCtrl = parts.includes('Ctrl')
    const wantShift = parts.includes('Shift')
    const wantAlt = parts.includes('Alt')
    const hasCtrl = e.ctrlKey || e.metaKey
    const keyMatches =
      key.length === 1 ? e.key.toUpperCase() === key : e.key === key
    return (
      keyMatches &&
      hasCtrl === wantCtrl &&
      e.shiftKey === wantShift &&
      e.altKey === wantAlt
    )
  }

  return (
    <div className="panel">
      <div className="panel__header">
        <span>{t('panel.chat')}</span>
        <div className="chat-header__actions">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as AIChatModel)}
            title={t('chat.model')}
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button onClick={openSettings} title={t('chat.settings')}>
            ⚙
          </button>
          <button onClick={clearMessages} title={t('chat.clear')}>
            🗑
          </button>
        </div>
      </div>

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="empty-placeholder">
            <div className="empty-placeholder__icon">💬</div>
            <div>{hasApiKey ? t('chat.empty.title') : t('chat.empty.noKey')}</div>
            <div style={{ fontSize: 12 }}>{t('chat.empty.hint')}</div>
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
            if (matchesSendShortcut(e)) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder={t('chat.placeholder')}
        />
        <div className="chat-input__actions">
          <span className="chat-input__hint">{hasApiKey ? '' : t('chat.noKeyHint')}</span>
          {isStreaming ? (
            <button className="chat-input__stop" onClick={stopStreaming}>
              {t('chat.stop')}
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim()}>
              {t('chat.send')}
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
