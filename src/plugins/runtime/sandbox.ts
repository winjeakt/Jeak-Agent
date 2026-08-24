import { BrowserWindow } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { PluginCommand } from '../../shared/types'
import type { LoadedPlugin } from '../loader/loader'

/** 沙箱宿主页面：data URL 加载，CSP 禁止一切网络与外部资源。
 * 插件源码通过内联 <script> 注入，页面加载时正常执行（避免 executeJavaScript 的序列化包装）。 */
const HOST_HTML = (name: string, script: string): string => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'">
<title>Jeak Plugin Host</title>
</head>
<body style="background:#1e1e1e;color:#ccc;font-family:monospace;padding:16px;">
<p>插件沙箱（不可见） · ${escapeHtml(name)}</p>
<script>${script}</script>
</body>
</html>`

export interface PluginSandboxCallbacks {
  /** 插件窗口创建后立即回调（用于绑定 IPC 安全上下文，避免竞态） */
  onCreated: (webContentsId: number) => void
  /** 插件注册/更新命令 */
  onCommandRegistered: (pluginName: string, commands: PluginCommand[]) => void
  /** 插件日志 */
  onLog: (pluginName: string, level: string, message: string) => void
  /** 插件运行错误 */
  onError: (pluginName: string, message: string) => void
}

/**
 * 插件沙箱（Agent Plugins 1.0 运行时）
 *
 * 安全模型（纵深防御）：
 * 1. 进程隔离：每个插件运行在独立 BrowserWindow（独立渲染进程）
 * 2. Electron 沙箱：sandbox: true + nodeIntegration: false
 * 3. 上下文隔离：contextIsolation: true，仅通过严格 preload 暴露受限 pluginAPI
 * 4. 宿主页面 CSP：default-src 'none'，插件无法发起任何网络/子资源请求
 * 5. 硬性拦截：禁止导航、弹窗、webview、devtools
 * 6. API 鉴权：所有 IPC 由主进程校验插件身份与权限白名单（见 security.ts / api/*）
 * 7. 插件代码通过 executeJavaScript 注入执行，无 require/process/node 访问
 */
export class PluginSandbox {
  readonly pluginName: string
  private win: BrowserWindow | null = null
  private registeredCommands = new Map<string, PluginCommand>()

  constructor(
    private readonly plugin: LoadedPlugin,
    private readonly callbacks: PluginSandboxCallbacks
  ) {
    this.pluginName = plugin.manifest.name
  }

  get webContentsId(): number | null {
    return this.win?.webContents.id ?? null
  }

  get commands(): PluginCommand[] {
    return [...this.registeredCommands.values()]
  }

  get isRunning(): boolean {
    return this.win !== null && !this.win.isDestroyed()
  }

  /** 启动沙箱：创建窗口 -> 加载宿主页面 -> 注入执行插件入口脚本 */
  async start(): Promise<void> {
    const { manifest, path: pluginDir } = this.plugin

    const win = new BrowserWindow({
      show: false,
      width: 480,
      height: 360,
      title: `Jeak Plugin: ${manifest.name}`,
      backgroundColor: '#1e1e1e',
      webPreferences: {
        preload: join(__dirname, '../preload/pluginPreload.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        webviewTag: false,
        backgroundThrottling: false,
        // 插件窗口无菜单、不可全屏
        ...(process.platform === 'darwin' ? {} : {})
      }
    })
    this.win = win

    // 硬性隔离：禁止一切导航 / 弹窗 / webview / 下载
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (event) => event.preventDefault())
    win.webContents.on('will-attach-webview', (event) => event.preventDefault())
    // 阻止插件发起任何下载
    win.webContents.session.on('will-download', (event) => event.preventDefault())

    // 转发插件窗口 console（含未捕获异常）到主进程日志，便于排查
    // 兼容旧签名 (event, level, message, line, sourceId) 与新签名 (event)
    win.webContents.on('console-message', (...args) => {
      const [eventArg, levelArg, messageArg, lineArg, sourceArg] = args
      const level =
        typeof levelArg === 'string'
          ? levelArg
          : (eventArg as { level?: string })?.level ?? 'log'
      const message =
        typeof messageArg === 'string'
          ? messageArg
          : (eventArg as { message?: string })?.message ?? String(eventArg ?? '')
      const line =
        typeof lineArg === 'number' ? lineArg : (eventArg as { lineNumber?: number })?.lineNumber ?? 0
      const source =
        typeof sourceArg === 'string' ? sourceArg : (eventArg as { sourceId?: string })?.sourceId ?? ''
      const levelName =
        level === 'error' ? 'error' : level === 'warning' || level === 'warn' ? 'warn' : 'info'
      this.callbacks.onLog(
        this.pluginName,
        `console.${levelName}`,
        `[${source}:${line}] ${message}`
      )
    })

    // 立即绑定安全上下文（必须在加载任何内容之前完成）
    this.callbacks.onCreated(win.webContents.id)

    // 读取插件入口源码并内联到宿主页面 <script>，页面加载时正常执行
    const entryFile = manifest.entry ?? 'plugin.js'
    const entryPath = join(pluginDir, entryFile)
    if (!existsSync(entryPath)) {
      throw new Error(`插件入口不存在: ${entryPath}`)
    }
    const source = readFileSync(entryPath, 'utf-8')

    // 加载宿主页面（data URL + CSP + 内联插件脚本）
    const host = HOST_HTML(manifest.name, source)
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(host)}`)
  }

  /** 插件窗口上报的命令注册（主进程校验来源后调用） */
  registerCommand(command: string, title: string): void {
    this.registeredCommands.set(command, { command, title })
    this.callbacks.onCommandRegistered(this.pluginName, [...this.registeredCommands.values()])
  }

  /** 主进程触发插件命令（如插件管理面板点击运行） */
  runCommand(command: string): void {
    if (!this.registeredCommands.has(command)) {
      throw new Error(`插件 ${this.pluginName} 未注册命令 ${command}`)
    }
    if (!this.win || this.win.isDestroyed()) {
      throw new Error(`插件 ${this.pluginName} 沙箱已销毁`)
    }
    this.win.webContents.send('plugin:command:run', { command })
  }

  log(level: string, message: string): void {
    this.callbacks.onLog(this.pluginName, level, message)
  }

  destroy(): void {
    this.registeredCommands.clear()
    if (this.win && !this.win.isDestroyed()) {
      this.win.destroy()
    }
    this.win = null
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }
    return map[ch] ?? ch
  })
}
