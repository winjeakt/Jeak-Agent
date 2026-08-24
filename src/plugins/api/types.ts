import type { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import type { AIService } from '../../main/services/AIService'
import type { EditorStateSnapshot, ProjectInfo } from '../../shared/types'
import type { PluginSecurityContext } from '../runtime/security'

/** 插件 API 注册所需的依赖注入（由 PluginManager 提供） */
export interface PluginApiDeps {
  /** 根据 IPC 事件来源查找插件安全上下文（非插件窗口 -> 抛错） */
  getContext: (event: IpcMainEvent | IpcMainInvokeEvent) => PluginSecurityContext
  aiService: AIService
  /** 主窗口（用于编辑器写入转发） */
  getMainWindow: () => BrowserWindow | null
  /** 编辑器状态镜像（由主窗口渲染进程同步） */
  getEditorState: () => EditorStateSnapshot | null
  /** 项目信息 */
  getProjectInfo: () => ProjectInfo
  /** 当前项目根目录（主进程从编辑器文件路径推导，供 git/lint 等确定工作目录） */
  getProjectRoot: () => string | null
}
