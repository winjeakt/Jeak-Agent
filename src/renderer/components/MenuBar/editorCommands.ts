/**
 * 编辑器命令桥接：菜单栏（编辑菜单）通过这里触发 Monaco 编辑器动作。
 * MonacoEditor 挂载时调用 setEditorInstance 注册实例。
 * 使用最小结构接口，避免直接依赖 monaco-editor 类型。
 */

interface EditorLike {
  trigger: (source: string | null | undefined, handlerId: string, payload: unknown) => void
  getAction: (id: string) => { run: () => Promise<unknown> | void } | null
  focus: () => void
}

let editorRef: EditorLike | null = null

/** MonacoEditor mount 时注册当前编辑器实例 */
export function setEditorInstance(editor: EditorLike | null): void {
  editorRef = editor
}

/** 获取当前编辑器实例 */
export function getEditorInstance(): EditorLike | null {
  return editorRef
}

/**
 * 执行编辑器命令。
 * @param command 命令名（见下方 switch）
 */
export function executeEditorCommand(command: string): void {
  const editor = editorRef
  if (!editor) {
    console.warn('[menu] 编辑器未就绪，忽略命令:', command)
    return
  }
  editor.focus()
  switch (command) {
    case 'undo':
      editor.trigger('menu', 'undo', null)
      break
    case 'redo':
      editor.trigger('menu', 'redo', null)
      break
    case 'cut':
      editor.trigger('menu', 'editor.action.clipboardCutAction', null)
      break
    case 'copy':
      editor.trigger('menu', 'editor.action.clipboardCopyAction', null)
      break
    case 'paste':
      editor.trigger('menu', 'editor.action.clipboardPasteAction', null)
      break
    case 'selectAll':
      editor.trigger('menu', 'editor.action.selectAll', null)
      break
    case 'find':
      editor.getAction('actions.find')?.run()
      break
    case 'replace':
      editor.getAction('editor.action.startFindReplaceAction')?.run()
      break
    case 'format':
      editor.getAction('editor.action.formatDocument')?.run()
      break
    case 'toggleComment':
      editor.getAction('editor.action.commentLine')?.run()
      break
    case 'gotoDefinition':
      editor.getAction('editor.action.revealDefinition')?.run()
      break
    case 'findReferences':
      editor.getAction('editor.action.referenceSearch.trigger')?.run()
      break
    case 'suggest':
      editor.getAction('editor.action.triggerSuggest')?.run()
      break
    case 'quickFix':
      editor.getAction('editor.action.quickFix')?.run()
      break
    default:
      console.warn('[menu] 未知编辑器命令:', command)
  }
}
