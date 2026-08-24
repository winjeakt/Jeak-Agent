import MonacoEditor from './MonacoEditor'
import DiagnosticsPanel from './DiagnosticsPanel'
import { useEditorStore } from '../../stores/editorStore'

export default function Editor(): JSX.Element {
  const currentFile = useEditorStore((s) => s.currentFile)

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="panel__header">
        <span>{currentFile ?? 'untitled'}</span>
      </div>
      <div className="panel__body">
        <MonacoEditor />
      </div>
      <DiagnosticsPanel />
    </div>
  )
}
