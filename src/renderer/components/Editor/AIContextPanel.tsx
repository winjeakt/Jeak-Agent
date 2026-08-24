import { useEffect, useRef } from 'react'
import { useExplainStore } from '../../stores/explainStore'
import { useT } from '../../stores/i18nStore'

/** Ctrl+E 触发的 AI 代码解释浮层（叠加在编辑器上） */
export default function AIContextPanel(): JSX.Element | null {
  const t = useT()
  const visible = useExplainStore((s) => s.visible)
  const code = useExplainStore((s) => s.code)
  const content = useExplainStore((s) => s.content)
  const streaming = useExplainStore((s) => s.streaming)
  const error = useExplainStore((s) => s.error)
  const close = useExplainStore((s) => s.close)
  const bodyRef = useRef<HTMLDivElement>(null)

  // 流式内容增长时自动滚动到底部
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [content, visible])

  // Esc 关闭
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, close])

  if (!visible) return null

  return (
    <div className="ai-panel">
      <div className="ai-panel__header">
        <span>{streaming ? t('explain.generating') : t('explain.title')}</span>
        <button onClick={close} title={t('explain.close')}>
          ✕
        </button>
      </div>
      <div className="ai-panel__code">
        <pre>{code}</pre>
      </div>
      <div className={`ai-panel__body${streaming ? ' ai-panel__body--streaming' : ''}`} ref={bodyRef}>
        {content || (streaming ? t('chat.thinking') : '')}
        {error && <div className="ai-panel__error">{error}</div>}
      </div>
    </div>
  )
}
