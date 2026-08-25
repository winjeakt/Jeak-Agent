import { create } from 'zustand'
import type { EditorLanguage } from '@shared/types'
import { detectLanguage } from '../monaco'

interface EditorState {
  /** 当前打开文件的路径（空表示未打开文件） */
  currentFile: string | null
  /** 编辑器内容 */
  content: string
  /** 当前语言 */
  language: EditorLanguage
  /** 打开文件 */
  openFile: (path: string, content: string, language: EditorLanguage) => void
  /** 更新内容 */
  setContent: (content: string) => void
  /** 关闭文件 */
  closeFile: () => void
  /** 新建空白文件 */
  newFile: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  currentFile: null,
  content: '// 欢迎使用 Jeak Agent\n// 在左侧打开文件，或直接在此编辑\n',
  language: 'typescript',
  openFile: (path, content, language) =>
    // 用 Monaco 内置扩展名映射权威识别语言，覆盖主进程推断结果
    set({ currentFile: path, content, language: detectLanguage(path) || language }),
  setContent: (content) => set({ content }),
  closeFile: () => set({ currentFile: null, content: '', language: 'plaintext' }),
  newFile: () => set({ currentFile: null, content: '', language: 'plaintext' })
}))
