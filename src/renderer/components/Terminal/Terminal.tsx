import { useEffect, useRef } from 'react'
import { useTerminalStore } from '../../stores/terminalStore'
import { useT } from '../../stores/i18nStore'

/** 终端面板：显示 shell 输出，支持输入命令 */
export default function Terminal(): JSX.Element {
  const t = useT()
  const started = useTerminalStore((s) => s.started)
  const lines = useTerminalStore((s) => s.lines)
  const input = useTerminalStore((s) => s.input)
  const start = useTerminalStore((s) => s.start)
  const write = useTerminalStore((s) => s.write)
  const dispose = useTerminalStore((s) => s.dispose)
  const appendOutput = useTerminalStore((s) => s.appendOutput)
  const setInput = useTerminalStore((s) => s.setInput)
  const clear = useTerminalStore((s) => s.clear)

  const bodyRef = useRef<HTMLDivElement>(null)

  // 启动终端 + 订阅输出
  useEffect(() => {
    start()
    const unsubscribe = window.jeak.terminal.onOutput(({ kind, data }) => {
      appendOutput(kind as 'stdout' | 'stderr' | 'system', data)
    })
    return () => {
      unsubscribe()
      dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 自动滚动到底部
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [lines])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (input.trim()) {
        write(input + '\r\n')
        setInput('')
      }
    }
  }

  return (
    <div className="terminal">
      <div className="terminal__header">
        <span className="terminal__title">{t('terminal.title')}</span>
        <div className="terminal__actions">
          <button title={t('terminal.clear')} onClick={clear}>
            🗑
          </button>
        </div>
      </div>
      <div className="terminal__body" ref={bodyRef} onClick={() => undefined}>
        {!started && <div className="terminal__hint">{t('terminal.starting')}</div>}
        {lines.map((line, i) => (
          <div key={i} className={`terminal__line terminal__line--${line.kind}`}>
            {line.text || '\u00a0'}
          </div>
        ))}
        <div className="terminal__input-row">
          <span className="terminal__prompt">❯</span>
          <input
            className="terminal__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('terminal.placeholder')}
            autoFocus
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  )
}
