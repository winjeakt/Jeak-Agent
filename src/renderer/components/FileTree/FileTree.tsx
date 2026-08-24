import { useT } from '../../stores/i18nStore'

export default function FileTree(): JSX.Element {
  const t = useT()
  return (
    <div className="panel">
      <div className="panel__header">
        <span>{t('panel.explorer')}</span>
      </div>
      <div className="panel__body">
        <div className="empty-placeholder">
          <div className="empty-placeholder__icon">📂</div>
          <div>{t('plugins.empty')}</div>
        </div>
      </div>
    </div>
  )
}
