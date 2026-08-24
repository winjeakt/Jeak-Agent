import type { Diagnostic } from '@shared/types'
import { useDiagnosticsStore } from '../../stores/diagnosticsStore'
import { useT } from '../../stores/i18nStore'

const SEVERITY_ICON: Record<Diagnostic['severity'], string> = {
  error: '✖',
  warning: '⚠',
  info: 'ℹ'
}

/** 底部问题面板：展示插件（如 ESLint）报告的问题列表 */
export default function DiagnosticsPanel(): JSX.Element {
  const t = useT()
  const diagnostics = useDiagnosticsStore((s) => s.diagnostics)
  const clear = useDiagnosticsStore((s) => s.clear)

  const errors = diagnostics.filter((d) => d.severity === 'error').length
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length

  return (
    <div className="diagnostics">
      <div className="diagnostics__header">
        <span className="diagnostics__title">
          {t('diagnostics.title')} {errors > 0 && <span className="diagnostics__err">✖ {errors}</span>}{' '}
          {warnings > 0 && <span className="diagnostics__warn">⚠ {warnings}</span>}
        </span>
        <button className="diagnostics__close" onClick={clear} title={t('diagnostics.clear')}>
          ✕
        </button>
      </div>
      {diagnostics.length === 0 ? (
        <div className="diagnostics__empty">✓ {t('diagnostics.empty')}</div>
      ) : (
        <ul className="diagnostics__list">
          {diagnostics.map((d, i) => (
            <li key={i} className={`diagnostics__item diagnostics__item--${d.severity}`}>
              <span className="diagnostics__icon">{SEVERITY_ICON[d.severity]}</span>
              <span className="diagnostics__msg">{d.message}</span>
              <span className="diagnostics__loc">
                {d.filePath ? `${d.filePath.split(/[\\/]/).pop()}:` : ''}
                {d.line}:{d.column}
              </span>
              {d.ruleId && <span className="diagnostics__rule">{d.ruleId}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
