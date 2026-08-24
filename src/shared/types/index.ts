/** 全局共享类型定义 */

/** 编辑器支持的语言映射 */
export type EditorLanguage =
  | 'typescript'
  | 'javascript'
  | 'json'
  | 'html'
  | 'css'
  | 'markdown'
  | 'python'
  | 'plaintext'

/** 应用主题（system 表示跟随操作系统） */
export type Theme = 'dark' | 'light' | 'system'

/** 界面语言 */
export type AppLanguage = 'zh' | 'en'

/** 应用信息（主进程返回） */
export interface AppInfo {
  version: string
  platform: string
  theme: Theme
}

/* ==================== Phase 2：AI 能力 ==================== */

/** 对话角色 */
export type ChatRole = 'system' | 'user' | 'assistant'

/** 发送给 AI 的消息（仅角色 + 内容） */
export interface AIChatMessage {
  role: ChatRole
  content: string
}

/** 支持的 DeepSeek 模型 */
export type AIChatModel = 'deepseek-chat' | 'deepseek-reasoner'

/** 流式对话请求（渲染进程 -> 主进程） */
export interface AIChatRequest {
  /** 会话 ID，用于关联流式增量 */
  id: string
  messages: AIChatMessage[]
  model: AIChatModel
  temperature?: number
  maxTokens?: number
}

/** AI 服务配置 */
export interface AISettings {
  apiKey: string
  model: AIChatModel
  temperature: number
  maxTokens: number
}

/** 应用设置（electron-store 持久化） */
export interface AppSettings {
  theme: Theme
  /** 界面语言 */
  language: AppLanguage
  ai: AISettings
  /** Phase 3：插件启用状态（disabled 列表） */
  plugins: { disabled: string[] }
  /** Phase 5：是否已完成首次引导 */
  onboarded: boolean
  /** Phase 5：快捷键配置 */
  shortcuts: ShortcutSettings
  /** Phase 6：界面布局 */
  layout: LayoutSettings
  /** 最近打开的项目/文件路径列表（供"文件"菜单展示） */
  recentProjects: string[]
  /** 是否开启自动保存 */
  autoSave: boolean
}

/** 快捷键设置（可自定义） */
export interface ShortcutSettings {
  /** AI 解释选中代码 */
  explain: string
  /** 发送对话消息 */
  send: string
  /** 打开设置 */
  settings: string
}

/** 默认快捷键 */
export const DEFAULT_SHORTCUTS: ShortcutSettings = {
  explain: 'Ctrl+E',
  send: 'Enter',
  settings: 'Ctrl+,'
}

/** 界面布局设置（可持久化） */
export interface LayoutSettings {
  /** 显示文件树 */
  showFileTree: boolean
  /** 显示终端 */
  showTerminal: boolean
  /** 显示对话面板 */
  showChat: boolean
}

/** 默认布局 */
export const DEFAULT_LAYOUT: LayoutSettings = {
  showFileTree: true,
  showTerminal: false,
  showChat: true
}

/** 终端输出类型 */
export type TerminalOutputKind = 'stdout' | 'stderr' | 'system'

/* ==================== Phase 3：插件系统（Agent Plugins 1.0） ==================== */

/** 插件可申请的权限（API 权限模型，主进程逐项校验） */
export type PluginPermission =
  | 'ai:chat'
  | 'ai:stream'
  | 'fs:read'
  | 'fs:write'
  | 'editor:get'
  | 'editor:apply'
  | 'project:get'
  | 'git:diff'
  | 'git:status'
  | 'git:run'
  | 'lint:run'

/** 插件声明/注册的命令 */
export interface PluginCommand {
  /** 唯一命令 ID（建议带插件名前缀，如 code-formatter.format） */
  command: string
  /** 显示名称 */
  title: string
}

/**
 * Agent Plugins 1.0 插件清单（plugin.json）规范。
 * 字段均为白名单：未列出的字段在加载时被忽略（不传递到沙箱）。
 */
export interface PluginManifest {
  /** 规范地址，如 https://jeak.dev/schemas/plugin-1.0.json */
  $schema?: string
  /** 插件名：kebab-case，全局唯一 */
  name: string
  /** 语义化版本号 x.y.z */
  version: string
  description?: string
  author?: string
  license?: string
  /** 入口脚本文件名（默认 plugin.js），仅允许插件目录内的文件 */
  entry?: string
  /** 申请的权限白名单 */
  permissions: PluginPermission[]
  /** 插件贡献点（命令等） */
  contributes?: {
    commands?: PluginCommand[]
  }
}

/** 插件运行状态 */
export type PluginStatus = 'ready' | 'error' | 'disabled'

/** 插件信息（主进程 -> 渲染进程，用于插件管理面板） */
export interface PluginInfo {
  name: string
  version: string
  description: string
  author: string
  license: string
  /** 插件绝对路径 */
  path: string
  /** 实际申请的权限 */
  permissions: PluginPermission[]
  /** 已注册的命令（插件启动后上报） */
  commands: PluginCommand[]
  enabled: boolean
  status: PluginStatus
  error?: string
}

/** 编辑器状态镜像（渲染进程 -> 主进程，供插件 editor API 读取） */
export interface EditorStateSnapshot {
  /** 当前文件路径（null 表示未打开文件） */
  path: string | null
  language: string
  content: string
  selection: {
    startLine: number
    startColumn: number
    endLine: number
    endColumn: number
    /** 选中文本（无选区时为空字符串） */
    text: string
  }
}

/** 编辑器写入动作（插件 -> 主进程 -> 主窗口渲染进程执行） */
export interface EditorApplyAction {
  type: 'replace-selection'
  text: string
}

/* ==================== Phase 4：核心插件能力 ==================== */

/** Lint 诊断级别 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info'

/** 单条 lint 诊断（ESLint 输出 -> 编辑器问题列表） */
export interface Diagnostic {
  severity: DiagnosticSeverity
  message: string
  /** 1 基起始行 */
  line: number
  /** 1 基起始列 */
  column: number
  /** 1 基结束行（无则等于 line） */
  endLine?: number
  /** 1 基结束列（无则等于 column） */
  endColumn?: number
  /** 规则名（如 no-unused-vars） */
  ruleId?: string
  /** 出错源文件路径 */
  filePath?: string
}

/** 编辑器动作：显示问题列表（Markers / 底部面板） */
export interface EditorShowDiagnosticsAction {
  type: 'show-diagnostics'
  diagnostics: Diagnostic[]
}

/** 编辑器动作联合类型（Phase 3 仅 replace-selection，Phase 4 扩展 show-diagnostics） */
export type EditorAction = EditorApplyAction | EditorShowDiagnosticsAction

/** git diff 请求参数 */
export interface GitDiffRequest {
  /** 'working'（工作区 vs HEAD）| 'staged'（暂存区 vs HEAD） */
  scope: 'working' | 'staged'
  /** 项目根目录（缺省使用当前项目） */
  cwd?: string
}

/** git 命令执行请求（受限白名单命令） */
export interface GitRunRequest {
  /** 允许的命令子集，如 ['rev-parse','--abbrev-ref','HEAD'] */
  args: string[]
  cwd?: string
}

/** lint 运行请求 */
export interface LintRunRequest {
  /** 目标文件路径（缺省使用编辑器当前文件） */
  filePath?: string
  /** 工作目录（用于解析配置与 node_modules） */
  cwd?: string
}

/** 项目信息（Phase 3 阶段尚无项目管理，根目录为空；Phase 4 扩展） */
export interface ProjectInfo {
  root: string | null
  /** 当前打开的文件列表 */
  openFiles: string[]
}

/* ==================== 菜单栏文件操作 ==================== */

/** 文件打开结果（主进程 dialog -> 渲染进程） */
export interface FileOpenResult {
  /** 用户是否取消 */
  canceled: boolean
  /** 文件绝对路径 */
  path?: string
  /** 文件内容（取消或读取失败时为空） */
  content?: string
  /** 根据扩展名推断的语言 */
  language?: EditorLanguage
}

/** 文件保存结果 */
export interface FileSaveResult {
  canceled: boolean
  /** 保存后的文件路径 */
  path?: string
}

/** 打开文件夹结果 */
export interface FolderOpenResult {
  canceled: boolean
  path?: string
}
