import type { Diagnostic } from '@shared/types'
import { useDiagnosticsStore } from '../../stores/diagnosticsStore'

const SEVERITY_ICON: Record<Diagnostic['severity'], string> = {
  error: '✖',
  warning: '⚠',
  info: 'ℹ'
}

/** 底部问题面板：展示插件（如 ESLint）报告的问题列表 */
export default function DiagnosticsPanel(): JSX.Element | null {
  const diagnostics = useDiagnosticsStore((s) => s.diagnostics)
  const clear = useDiagnosticsStore((s) => s.clear)

  if (diagnostics.length === 0) return null

  const errors = diagnostics.filter((d) => d.severity === 'error').length
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length

  return (
    <div className="diagnostics">
      <div className="diagnostics__header">
        <span className="diagnostics__title">
          问题 {errors > 0 && <span className="diagnostics__err">✖ {errors}</span>}{' '}
          {warnings > 0 && <span className="diagnostics__warn">⚠ {warnings}</span>}
        </span>
        <button className="diagnostics__close" onClick={clear} title="清空">
          ✕
        </button>
      </div>
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
    </div>
  )
}
