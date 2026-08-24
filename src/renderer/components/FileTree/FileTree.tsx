import { useState } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useT } from '../../stores/i18nStore'
import type { FileTreeNode } from '@shared/types'

/** 单个文件树节点（目录可懒加载展开，文件点击打开） */
function TreeNode({ node, depth }: { node: FileTreeNode; depth: number }): JSX.Element {
  const openFile = useEditorStore((s) => s.openFile)
  const [expanded, setExpanded] = useState(depth < 2)
  const [children, setChildren] = useState<FileTreeNode[]>(node.children ?? [])

  const isDir = node.type === 'directory'

  const toggle = (): void => {
    if (!isDir) return
    if (!expanded && children.length === 0) {
      void window.jeak.workspace.readTree(node.path).then(setChildren)
    }
    setExpanded((v) => !v)
  }

  const open = async (): Promise<void> => {
    if (isDir) return
    const result = await window.jeak.workspace.openPath(node.path)
    if (!result.canceled && result.kind === 'file' && result.path) {
      openFile(result.path, result.content ?? '', result.language ?? 'plaintext')
    }
  }

  const icon = isDir ? (expanded ? '📂' : '📁') : '📄'

  return (
    <div className="tree-node">
      <div
        className="tree-node__row"
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={isDir ? toggle : () => void open()}
        title={node.path}
      >
        <span className="tree-node__chevron">{isDir ? (expanded ? '▾' : '▸') : ''}</span>
        <span className="tree-node__icon">{icon}</span>
        <span className="tree-node__name">{node.name}</span>
      </div>
      {isDir && expanded && (
        <div className="tree-node__children">
          {children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FileTree(): JSX.Element {
  const t = useT()
  const root = useWorkspaceStore((s) => s.root)
  const tree = useWorkspaceStore((s) => s.tree)
  const loading = useWorkspaceStore((s) => s.loading)

  const openFolder = async (): Promise<void> => {
    const result = await window.jeak.file.openFolder()
    if (result.canceled || !result.path) return
    await useWorkspaceStore.getState().loadTree(result.path)
    await window.jeak.recent.add(result.path)
  }

  return (
    <div className="panel">
      <div className="panel__header">
        <span>{t('panel.explorer')}</span>
        <button className="panel__action" title={t('menu.file.openFolder')} onClick={() => void openFolder()}>
          📂
        </button>
      </div>
      <div className="panel__body">
        {!root ? (
          <div className="empty-placeholder">
            <div className="empty-placeholder__icon">📂</div>
            <div>{t('filetree.empty')}</div>
            <button className="filetree__open-btn" onClick={() => void openFolder()}>
              {t('menu.file.openFolder')}
            </button>
          </div>
        ) : (
          <div className="filetree">
            <div className="filetree__root" title={root}>
              {root}
            </div>
            {loading ? (
              <div className="filetree__loading">{t('filetree.loading')}</div>
            ) : tree.length === 0 ? (
              <div className="filetree__loading">{t('filetree.emptyDir')}</div>
            ) : (
              tree.map((node) => <TreeNode key={node.path} node={node} depth={0} />)
            )}
          </div>
        )}
      </div>
    </div>
  )
}
