import MonacoEditor from './MonacoEditor'
import DiagnosticsPanel from './DiagnosticsPanel'
import OutputPanel from './OutputPanel'
import EditorToolbar from './EditorToolbar'
import Terminal from '../Terminal/Terminal'
import { useEditorStore } from '../../stores/editorStore'
import { useLayoutStore } from '../../stores/layoutStore'
import { useUIStore } from '../../stores/uiStore'
import { useDiagnosticsStore } from '../../stores/diagnosticsStore'
import { useT } from '../../stores/i18nStore'

export default function Editor(): JSX.Element {
  const t = useT()
  const currentFile = useEditorStore((s) => s.currentFile)
  const showTerminal = useLayoutStore((s) => s.showTerminal)
  const bottomPanel = useUIStore((s) => s.bottomPanel)
  const editorLayout = useUIStore((s) => s.editorLayout)
  const diagnostics = useDiagnosticsStore((s) => s.diagnostics)

  const showOutput = bottomPanel === 'output'
  const showDiagnostics = bottomPanel === 'diagnostics' || (bottomPanel === 'none' && diagnostics.length > 0)

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="panel__header">
        <span>{currentFile ?? 'untitled'}</span>
      </div>
      <EditorToolbar />
      <div className="panel__body">
        <div className="editor-area" data-layout={editorLayout}>
          <div className="editor-area__pane">
            <MonacoEditor />
          </div>
          {editorLayout >= 2 && (
            <div className="editor-area__pane editor-area__pane--empty">
              <div className="editor-area__empty">{t('menu.view.editorGroup.two')}</div>
            </div>
          )}
          {editorLayout >= 3 && (
            <div className="editor-area__pane editor-area__pane--empty">
              <div className="editor-area__empty">{t('menu.view.editorGroup.three')}</div>
            </div>
          )}
        </div>
      </div>
      {showTerminal && <Terminal />}
      {showDiagnostics && <DiagnosticsPanel />}
      {showOutput && <OutputPanel />}
    </div>
  )
}
