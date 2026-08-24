import MonacoEditor from './MonacoEditor'
import DiagnosticsPanel from './DiagnosticsPanel'
import EditorToolbar from './EditorToolbar'
import Terminal from '../Terminal/Terminal'
import { useEditorStore } from '../../stores/editorStore'
import { useLayoutStore } from '../../stores/layoutStore'

export default function Editor(): JSX.Element {
  const currentFile = useEditorStore((s) => s.currentFile)
  const showTerminal = useLayoutStore((s) => s.showTerminal)

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="panel__header">
        <span>{currentFile ?? 'untitled'}</span>
      </div>
      <EditorToolbar />
      <div className="panel__body">
        <MonacoEditor />
      </div>
      {showTerminal && <Terminal />}
      <DiagnosticsPanel />
    </div>
  )
}
