import { useLayoutStore } from '../../stores/layoutStore'
import { useT } from '../../stores/i18nStore'

/** 编辑器顶部工具栏：右侧提供界面布局切换按钮 */
export default function EditorToolbar(): JSX.Element {
  const t = useT()
  const showFileTree = useLayoutStore((s) => s.showFileTree)
  const showTerminal = useLayoutStore((s) => s.showTerminal)
  const showChat = useLayoutStore((s) => s.showChat)
  const toggle = useLayoutStore((s) => s.toggle)

  const items = [
    { key: 'showFileTree' as const, active: showFileTree, icon: '🗂', label: t('layout.fileTree') },
    { key: 'showTerminal' as const, active: showTerminal, icon: '⌨', label: t('layout.terminal') },
    { key: 'showChat' as const, active: showChat, icon: '💬', label: t('layout.chat') }
  ]

  return (
    <div className="editor-toolbar">
      <span className="editor-toolbar__title">{t('panel.editor')}</span>
      <div className="editor-toolbar__actions">
        {items.map((item) => (
          <button
            key={item.key}
            className={`editor-toolbar__btn${item.active ? ' editor-toolbar__btn--active' : ''}`}
            onClick={() => toggle(item.key)}
            title={item.label}
          >
            {item.icon}
          </button>
        ))}
      </div>
    </div>
  )
}
