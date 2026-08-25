/** 全局共享类型定义 */

/** 编辑器支持的语言映射（覆盖 Monaco 内置全部语言） */
export type EditorLanguage =
  | 'abap'
  | 'apex'
  | 'azcli'
  | 'bat'
  | 'bicep'
  | 'cameligo'
  | 'clojure'
  | 'coffeescript'
  | 'cpp'
  | 'csharp'
  | 'csp'
  | 'css'
  | 'cypher'
  | 'dart'
  | 'dockerfile'
  | 'ecl'
  | 'elixir'
  | 'flow9'
  | 'fsharp'
  | 'freemarker2'
  | 'go'
  | 'graphql'
  | 'handlebars'
  | 'hcl'
  | 'html'
  | 'ini'
  | 'java'
  | 'javascript'
  | 'json'
  | 'julia'
  | 'kotlin'
  | 'less'
  | 'lexon'
  | 'liquid'
  | 'lua'
  | 'm3'
  | 'markdown'
  | 'mdx'
  | 'mips'
  | 'msdax'
  | 'mysql'
  | 'objective-c'
  | 'pascal'
  | 'pascaligo'
  | 'perl'
  | 'pgsql'
  | 'php'
  | 'pla'
  | 'postiats'
  | 'powerquery'
  | 'powershell'
  | 'protobuf'
  | 'pug'
  | 'python'
  | 'qsharp'
  | 'r'
  | 'razor'
  | 'redis'
  | 'redshift'
  | 'restructuredtext'
  | 'ruby'
  | 'rust'
  | 'sb'
  | 'scala'
  | 'scheme'
  | 'scss'
  | 'shell'
  | 'solidity'
  | 'sophia'
  | 'sparql'
  | 'sql'
  | 'st'
  | 'swift'
  | 'systemverilog'
  | 'tcl'
  | 'twig'
  | 'typescript'
  | 'typespec'
  | 'vb'
  | 'wgsl'
  | 'xml'
  | 'yaml'
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

/** 对话角色（tool 用于 function calling 的工具返回消息） */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

/** 发送给 AI 的消息（角色 + 内容 + 可选工具调用信息） */
export interface AIChatMessage {
  role: ChatRole
  content: string
  /** assistant 消息可能携带：请求调用外部工具 */
  tool_calls?: AIToolCall[]
  /** tool 消息必填：对应某次 tool_call 的返回 */
  tool_call_id?: string
}

/** 模型请求调用的工具（OpenAI function calling 格式） */
export interface AIToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    /** JSON 字符串形式的调用参数 */
    arguments: string
  }
}

/** 可供模型调用的工具定义（MCP tools 转换而来，OpenAI 格式） */
export interface AIToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    /** JSON Schema 参数 */
    parameters: Record<string, unknown>
  }
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
  /** 可供模型调用的工具（MCP tools 转换而来） */
  tools?: AIToolDefinition[]
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

/** Agent Plugins 1.0 作者对象 */
export interface PluginAuthor {
  name?: string
  email?: string
  url?: string
}

/**
 * Agent Plugins 1.0 插件清单（plugin.json）规范。
 * 顶层字段遵循官方 schema；命令型插件的能力声明放在客户端扩展命名空间
 * `extensions["dev.jeak-agent"]` 下（同时向后兼容旧版顶层字段）。
 * 未列出的字段在加载时被忽略（不传递到沙箱）。
 */
export interface PluginManifest {
  /** 规范地址，如 https://agent-plugins.org/schemas/1.0.0/plugin.schema.json */
  $schema?: string
  /** 插件名：官方规则（小写字母/数字/点/连字符，首尾字母数字，禁 .. 与 --） */
  name: string
  /** 语义化版本号 x.y.z */
  version: string
  description?: string
  /** 作者（官方为对象，兼容旧版字符串） */
  author?: PluginAuthor
  homepage?: string
  repository?: string
  license?: string
  keywords?: string[]
  /** 客户端扩展（反向域名 key -> 任意值） */
  extensions?: Record<string, unknown>
  /** [兼容 GitHub Copilot 插件格式] 技能目录（相对插件目录，字符串或字符串数组） */
  skills?: string | string[]
  /** [兼容 GitHub Copilot 插件格式] agent 目录（相对插件目录，字符串或字符串数组） */
  agents?: string | string[]
  /** [Jeak 扩展] 入口脚本文件名（命令型插件，仅允许插件目录内 .js） */
  entry?: string
  /** [Jeak 扩展] 申请的权限白名单 */
  permissions: PluginPermission[]
  /** [Jeak 扩展] 插件贡献点（命令等） */
  contributes?: {
    commands?: PluginCommand[]
  }
}

/* ==================== Agent Plugins 1.0：mcp.json & skills ==================== */

/** mcp.json 中的单个 server 配置（stdio / streamable-http 两种传输） */
export type MCPServerConfig =
  | {
      type: 'stdio'
      /** 启动命令（不展开占位符） */
      command: string
      args?: string[]
      env?: Record<string, string>
      cwd?: string
    }
  | {
      type: 'streamable-http'
      /** MCP streamable HTTP 端点 */
      url: string
      headers?: Record<string, string>
    }

/** mcp.json 顶层结构 */
export interface MCPManifest {
  $schema?: string
  mcpServers: Record<string, MCPServerConfig>
}

/** Agent Plugins 1.0 skills 目录中的单个 skill */
export interface SkillInfo {
  /** skill 名（来自 SKILL.md frontmatter 的 name，缺省为目录名） */
  name: string
  /** skill 描述（来自 frontmatter 的 description） */
  description: string
  /** skill 目录绝对路径 */
  path: string
  /** SKILL.md 正文（去掉 frontmatter） */
  body: string
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

/** 插件市场条目（插件市场面板展示，含是否已安装标记） */
export interface MarketPluginInfo {
  name: string
  version: string
  description: string
  author: string
  license: string
  /** 是否已安装到本地插件目录 */
  installed: boolean
}

/** Awesome Copilot 在线市场插件条目（主进程 -> 渲染进程） */
export interface AwesomePluginInfo {
  /** 文件夹名（唯一标识，用于拼接 GitHub 安装地址） */
  folder: string
  /** 显示名称（plugin.json.name，缺失时回退为 folder） */
  name: string
  /** 描述（plugin.json.description，缺失时为空串） */
  description: string
  /** 是否「信息待完善」（未能读取/解析 plugin.json） */
  pending: boolean
  /** 来源标识（固定） */
  source: 'Awesome Copilot'
  /** 远程 plugin.json 声明的版本号（读取失败时为 undefined） */
  version?: string
  /** 完整 GitHub 安装地址 */
  url: string
}

/** 官方插件索引条目（plugins-index.json，主进程 -> 渲染进程） */
export interface OfficialPluginEntry {
  /** 插件名称（唯一标识） */
  name: string
  /** 简短描述 */
  description: string
  /** 作者名 */
  author: string
  /** 插件 GitHub 仓库地址（用于「安装」） */
  repo: string
  /** 分类（如：代码工具 / Git / 调试） */
  category: string
  /** 是否官方认证 */
  verified: boolean
  /** 是否精选（在市场顶部「官方推荐」区块置顶展示） */
  featured: boolean
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

/* ==================== Phase 6：自动更新 ==================== */

/** 自动更新状态 */
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

/** 更新状态快照（主进程 -> 渲染进程） */
export interface UpdateState {
  status: UpdateStatus
  /** 目标版本号（available / downloaded 时有效） */
  version: string
  /** 下载进度（0-100） */
  percent: number
  /** 错误信息 */
  error: string | null
}

/** 检查更新结果 */
export interface CheckUpdateResult {
  available: boolean
  version: string
  /** 是否为开发模式（未打包） */
  dev?: boolean
}

/* ==================== 工作区 & 文件树 ==================== */

/** 文件树节点 */
export interface FileTreeNode {
  /** 文件/目录名 */
  name: string
  /** 绝对路径 */
  path: string
  /** 节点类型 */
  type: 'file' | 'directory'
  /** 子节点（仅目录，懒加载时可为空） */
  children?: FileTreeNode[]
}

/** 按路径打开的结果（文件 or 文件夹，供"最近打开"菜单直接打开） */
export interface WorkspaceOpenResult {
  canceled: boolean
  /** 路径类型 */
  kind: 'file' | 'directory'
  /** 绝对路径 */
  path?: string
  /** 文件内容（kind === 'file' 时有效） */
  content?: string
  /** 语言（kind === 'file' 时有效） */
  language?: EditorLanguage
  /** 目录树（kind === 'directory' 时有效） */
  tree?: FileTreeNode[]
}

/** 终端 shell 类型 */
export type ShellKind = 'powershell' | 'cmd' | 'bash'
