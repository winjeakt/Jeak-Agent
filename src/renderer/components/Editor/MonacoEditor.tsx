import Editor from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'
import type { Diagnostic, EditorStateSnapshot } from '@shared/types'
import { useEditorStore } from '../../stores/editorStore'
import { useExplainStore } from '../../stores/explainStore'
import { useDiagnosticsStore } from '../../stores/diagnosticsStore'
import { useI18nStore } from '../../stores/i18nStore'
import { setEditorInstance } from '../MenuBar/editorCommands'

/**
 * Monaco 编辑器：
 * - 受控于 editorStore
 * - 实时同步状态镜像到主进程（供插件 editor API 读取）
 * - 处理插件写入动作（如 replace-selection）
 * - 注册 Ctrl+E（Mac 为 Cmd+E）：选中代码后弹出 AI 解释浮层；
 *   无选区时解释光标所在行。
 */
const handleMount: OnMount = (editor, monaco) => {
  /* 注册编辑器实例，供菜单栏（编辑菜单）命令桥接使用 */
  setEditorInstance(editor)

  /* ---- 编辑器状态镜像同步（供插件 editor API） ---- */
  let lastSync = 0
  const syncState = (): void => {
    const model = editor.getModel()
    if (!model) return
    const now = Date.now()
    if (now - lastSync < 80) return
    lastSync = now
    const selection = editor.getSelection()
    const store = useEditorStore.getState()
    const snapshot: EditorStateSnapshot = {
      path: store.currentFile,
      language: store.language,
      content: model.getValue(),
      selection: {
        startLine: selection?.startLineNumber ?? 1,
        startColumn: selection?.startColumn ?? 1,
        endLine: selection?.endLineNumber ?? 1,
        endColumn: selection?.endColumn ?? 1,
        text: selection && !selection.isEmpty() ? model.getValueInRange(selection) : ''
      }
    }
    window.jeak.editor.sync(snapshot)
  }
  const contentDisposable = editor.onDidChangeModelContent(syncState)
  const selectionDisposable = editor.onDidChangeCursorSelection(syncState)
  syncState()

  /* ---- 插件编辑器写入（如 code-formatter 替换选区） ---- */
  const unsubscribeApply = window.jeak.editor.onApply((action) => {
    if (action.type !== 'replace-selection') return
    const model = editor.getModel()
    const selection = editor.getSelection()
    if (!model || !selection) return
    editor.executeEdits('plugin', [
      { range: selection, text: action.text, forceMoveMarkers: true }
    ])
    editor.focus()
  })

  /* ---- 插件"显示问题列表"：写入 Monaco Markers + 底部面板 ---- */
  const unsubscribeDiagnostics = window.jeak.editor.onShowDiagnostics((action) => {
    const model = editor.getModel()
    if (!model) return
    useDiagnosticsStore.getState().setDiagnostics(action.diagnostics)
    const markers = action.diagnostics.map((d: Diagnostic) => ({
      severity:
        d.severity === 'error' ? 8 : d.severity === 'warning' ? 4 : 2,
      message: d.ruleId ? `${d.message} (${d.ruleId})` : d.message,
      startLineNumber: d.line,
      startColumn: d.column,
      endLineNumber: d.endLine ?? d.line,
      endColumn: d.endColumn ?? d.column + 1
    }))
    monaco.editor.setModelMarkers(model, 'plugin-diagnostics', markers)
  })

  /* ---- Ctrl+E：AI 解释选中代码 ---- */
  editor.addAction({
    id: 'jeak.explainSelection',
    label: 'AI 解释选中代码',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyE],
    run: (ed) => {
      const model = ed.getModel()
      if (!model) return

      const selection = ed.getSelection()
      let code: string

      if (selection && !selection.isEmpty()) {
        code = model.getValueInRange(selection)
      } else {
        // 无选区：解释光标所在行
        const line = selection?.startLineNumber ?? 1
        code = model.getLineContent(line)
        if (!code.trim()) return
      }

      if (code.trim()) {
        useExplainStore.getState().open(code.trim(), useEditorStore.getState().language)
      }
    }
  })

  /* ---- 组件/编辑器销毁时清理订阅 ---- */
  editor.onDidDispose(() => {
    contentDisposable.dispose()
    selectionDisposable.dispose()
    unsubscribeApply()
    unsubscribeDiagnostics()
    setEditorInstance(null)
  })
}

export default function MonacoEditor(): JSX.Element {
  const content = useEditorStore((s) => s.content)
  const language = useEditorStore((s) => s.language)
  const setContent = useEditorStore((s) => s.setContent)
  const theme = useI18nStore((s) => s.theme)

  return (
    <Editor
      height="100%"
      language={language}
      value={content}
      onChange={(value) => setContent(value ?? '')}
      theme={theme === 'light' ? 'vs' : 'vs-dark'}
      onMount={handleMount}
      loading={<div className="empty-placeholder">{'…'}</div>}
      options={{
        fontSize: 14,
        fontFamily: "Consolas, 'Courier New', monospace",
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'off',
        renderLineHighlight: 'all',
        padding: { top: 8 },
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        mouseWheelZoom: true
      }}
    />
  )
}
