import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useI18nStore } from '../stores/i18nStore'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** 全局 React 错误边界：捕获渲染错误并展示友好提示 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[renderer] 组件渲染错误:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorFallback message={this.state.error.message} onClose={() => this.setState({ error: null })} />
    }
    return this.props.children
  }
}

function ErrorFallback({ message, onClose }: { message: string; onClose: () => void }): JSX.Element {
  const t = useI18nStore.getState().t
  return (
    <div className="error-fallback">
      <div className="error-fallback__card">
        <div className="error-fallback__icon">⚠️</div>
        <h2>{t('error.fatal.title')}</h2>
        <p>{t('error.fatal.hint')}</p>
        <pre className="error-fallback__msg">{message || t('error.unknown')}</pre>
        <div className="error-fallback__actions">
          <button className="primary" onClick={() => window.location.reload()}>
            {t('error.reload')}
          </button>
          <button className="ghost" onClick={onClose}>
            {t('error.fatal.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
