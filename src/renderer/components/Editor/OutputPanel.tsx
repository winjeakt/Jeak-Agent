import { useOutputStore } from '../../stores/outputStore'
import { useT } from '../../stores/i18nStore'

/** 底部"输出"面板：展示系统 / AI 等运行日志 */
export default function OutputPanel(): JSX.Element {
  const t = useT()
  const lines = useOutputStore((s) => s.lines)
  const clear = useOutputStore((s) => s.clear)

  return (
    <div className="output-panel">
      <div className="output-panel__header">
        <span className="output-panel__title">{t('panel.output')}</span>
        <button className="output-panel__clear" onClick={clear} title={t('output.clear')}>
          {t('output.clear')}
        </button>
      </div>
      <div className="output-panel__body">
        {lines.length === 0 ? (
          <div className="output-panel__empty">{t('output.empty')}</div>
        ) : (
          lines.map((l) => (
            <div key={l.id} className={`output-panel__line output-panel__line--${l.kind}`}>
              <span className="output-panel__time">[{l.time}]</span>
              <span className="output-panel__text">{l.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
