import { create } from 'zustand'
import type { FileTreeNode } from '@shared/types'

interface WorkspaceState {
  /** 工作区根目录（打开的文件夹） */
  root: string | null
  /** 根目录下的文件树 */
  tree: FileTreeNode[]
  /** 是否正在加载 */
  loading: boolean
  /** 加载指定目录为工作区 */
  loadTree: (path: string) => Promise<void>
  /** 刷新当前工作区 */
  refresh: () => Promise<void>
  /** 关闭工作区 */
  clear: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  root: null,
  tree: [],
  loading: false,
  loadTree: async (path) => {
    set({ loading: true, root: path })
    const tree = await window.jeak.workspace.readTree(path)
    set({ tree, loading: false })
  },
  refresh: async () => {
    const root = get().root
    if (!root) return
    await get().loadTree(root)
  },
  clear: () => set({ root: null, tree: [], loading: false })
}))
