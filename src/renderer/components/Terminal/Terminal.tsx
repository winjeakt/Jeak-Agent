import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useTerminalStore, type TerminalSessionState } from '../../stores/terminalStore'
import { useT } from '../../stores/i18nStore'

/** 单个终端会话视图 */
function SessionView({ session }: { session: TerminalSessionState }): JSX.Element {
  const t = useT()
  const write = useTerminalStore((s) => s.write)
  const setInput = useTerminalStore((s) => s.setInput)
  const historyUp = useTerminalStore((s) => s.historyUp)
  const historyDown = useTerminalStore((s) => s.historyDown)

  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [session.lines])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (session.input.trim()) {
        write(session.id, session.input + '\r\n')
        setInput(session.id, '')
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      historyUp(session.id)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      historyDown(session.id)
    }
  }

  return (
    <div className="terminal__body" ref={bodyRef}>
      {!session.started && <div className="terminal__hint">{t('terminal.starting')}</div>}
      {session.lines.map((line, i) => (
        <div key={i} className={`terminal__line terminal__line--${line.kind}`}>
          {line.text || '\u00a0'}
        </div>
      ))}
      <div className="terminal__input-row">
        <span className="terminal__prompt">❯</span>
        <input
          className="terminal__input"
          value={session.input}
          onChange={(e) => setInput(session.id, e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('terminal.placeholder')}
          autoFocus
          spellCheck={false}
        />
      </div>
    </div>
  )
}

/** 终端面板：多会话 tab + 输出 + 输入 */
export default function Terminal(): JSX.Element {
  const t = useT()
  const sessions = useTerminalStore((s) => s.sessions)
  const activeId = useTerminalStore((s) => s.activeId)
  const createSession = useTerminalStore((s) => s.createSession)
  const setActive = useTerminalStore((s) => s.setActive)
  const closeSession = useTerminalStore((s) => s.closeSession)
  const start = useTerminalStore((s) => s.start)
  const appendOutput = useTerminalStore((s) => s.appendOutput)

  // 订阅主进程终端输出（全局，一次）
  useEffect(() => {
    const unsubscribe = window.jeak.terminal.onOutput(({ sessionId, kind, data }) => {
      appendOutput(sessionId, kind as 'stdout' | 'stderr' | 'system', data)
    })
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 初始化：至少保证一个会话并启动
  useEffect(() => {
    if (sessions.length === 0) {
      const id = createSession()
      start(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 卸载时终止所有 shell 进程（保留会话与输出）
  useEffect(() => {
    return () => {
      useTerminalStore.getState().disposeAll()
    }
  }, [])

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0]

  const handleAdd = (): void => {
    const id = createSession()
    start(id)
  }

  return (
    <div className="terminal">
      <div className="terminal__tabs">
        {sessions.map((sess) => (
          <div
            key={sess.id}
            className={`terminal__tab${sess.id === active?.id ? ' terminal__tab--active' : ''}`}
            onClick={() => setActive(sess.id)}
            title={sess.name}
          >
            <span className="terminal__tab-name">{sess.name}</span>
            <button
              className="terminal__tab-close"
              title={t('terminal.close')}
              onClick={(e) => {
                e.stopPropagation()
                closeSession(sess.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button className="terminal__add" title={t('menu.terminal.new')} onClick={handleAdd}>
          ＋
        </button>
      </div>
      {active ? (
        <SessionView key={active.id} session={active} />
      ) : (
        <div className="terminal__empty">{t('terminal.empty')}</div>
      )}
    </div>
  )
}
