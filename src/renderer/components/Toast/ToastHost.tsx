import { useToastStore } from './toastStore'

/** 全局 Toast 容器，挂载在应用顶层 */
export default function ToastHost(): JSX.Element {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="toast-host">
      {toasts.map((item) => (
        <div
          key={item.id}
          className={`toast toast--${item.type}`}
          onClick={() => dismiss(item.id)}
        >
          <span className="toast__icon">{item.type === 'success' ? '✓' : '✕'}</span>
          <span className="toast__message">{item.message}</span>
        </div>
      ))}
    </div>
  )
}
