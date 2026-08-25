import { useEffect, useRef, useState } from 'react'
import type { AIChatModel } from '@shared/types'
import { useChatStore } from '../../stores/chatStore'
import type { ChatMessage, ToolCallRecord } from '../../stores/chatStore'
import { useT } from '../../stores/i18nStore'
import { useUIStore } from '../../stores/uiStore'
import { MODEL_OPTIONS } from '../../constants/models'

/** 截取工具返回结果的前 100 个字符作为摘要 */
function summarizeResult(text?: string): string {
  const s = (text ?? '').replace(/\s+/g, ' ').trim()
  return s.length > 100 ? `${s.slice(0, 100)}…` : s
}

function ToolCallList({ toolCalls }: { toolCalls: ToolCallRecord[] }): JSX.Element {
  const t = useT()
  return (
    <div className="chat-msg__tool-calls">
      {toolCalls.map((tc, i) => {
        if (tc.status === 'running') {
          return (
            <div key={i} className="chat-msg__tool-call chat-msg__tool-call--running">
              <span className="chat-msg__tool-spinner" />
              🔧 {t('chat.callingTool')}：{tc.name}…
            </div>
          )
        }
        if (tc.status === 'success') {
          return (
            <div key={i} className="chat-msg__tool-call chat-msg__tool-call--success">
              ✅ {t('chat.toolResult')}：{summarizeResult(tc.result)}
            </div>
          )
        }
        return (
          <div key={i} className="chat-msg__tool-call chat-msg__tool-call--error">
            ❌ {t('chat.toolFailed')}：{tc.error}
          </div>
        )
      })}
    </div>
  )
}

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
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallList toolCalls={message.toolCalls} />
        )}
        {message.error && <div className="chat-msg__error">{message.error}</div>}
      </div>
    </div>
  )
}



function AvailableToolsIndicator(): JSX.Element | null {
  const t = useT()
  const [tools, setTools] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)

  const messages = useChatStore((s) => s.messages)
  const runningTools = Array.from(
    new Set(
      messages.flatMap((m) =>
        (m.toolCalls ?? [])
          .filter((tc) => tc.status === 'running')
          .map((tc) => tc.name)
      )
    )
  )

  useEffect(() => {
    const refresh = (): void => {
      void window.jeak.mcp.listTools().then((defs) => {
        setTools(defs.map((d) => d.function.name))
      })
    }
    refresh()
    // 插件启用/禁用导致工具数量变化时，自动刷新
    const unsub = window.jeak.plugins.onChanged(() => refresh())
    return unsub
  }, [])

  if (tools.length === 0 && runningTools.length === 0) return null

  return (
    <div className="available-tools">
      <button
        className="available-tools__badge"
        onClick={() => setExpanded((v) => !v)}
        title={t('chat.availableTools')}
      >
        🔧 {t('chat.availableTools')} ({tools.length})
      </button>
      {runningTools.map((name) => (
        <span key={name} className="available-tools__running">
          <span className="chat-msg__tool-spinner" />
          {name}
        </span>
      ))}
      {expanded && (
        <div className="available-tools__popover">
          {tools.map((name) => (
            <span
              key={name}
              className={`available-tools__chip${runningTools.includes(name) ? ' is-active' : ''}`}
            >
              {name}
            </span>
          ))}
        </div>
      )}
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
          <button onClick={() => openSettings()} title={t('chat.settings')}>
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

      <AvailableToolsIndicator />

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
