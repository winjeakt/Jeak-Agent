import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { ipcMain, type WebContents } from 'electron'
import type { ShellKind } from '../../shared/types'

interface TerminalSession {
  id: string
  shell: ShellKind
  proc: ChildProcessWithoutNullStreams | null
}

/** 解析 shell 类型对应的可执行文件与启动参数 */
function resolveShell(shell: ShellKind): { executable: string; args: string[] } {
  switch (shell) {
    case 'cmd':
      return { executable: 'cmd.exe', args: ['/Q'] }
    case 'bash':
      return { executable: 'bash', args: ['-i'] }
    case 'powershell':
    default:
      // -NoExit 保持交互；-Command - 从 stdin 读取
      return { executable: 'powershell.exe', args: ['-NoLogo', '-NoExit', '-Command', '-'] }
  }
}

/**
 * 终端服务：管理多个 shell 会话（主进程 child_process.spawn），
 * 通过 IPC 与渲染进程双向通信。
 */
export class TerminalService {
  private sessions = new Map<string, TerminalSession>()
  private readonly sender: WebContents

  constructor(sender: WebContents) {
    this.sender = sender
  }

  /** 启动一个新 shell 会话（sessionId 由渲染层生成） */
  start(sessionId: string, shell: ShellKind = 'powershell'): void {
    if (this.sessions.has(sessionId)) return

    const session: TerminalSession = { id: sessionId, shell, proc: null }
    this.sessions.set(sessionId, session)

    const { executable, args } = resolveShell(shell)

    try {
      session.proc = spawn(executable, args, {
        cwd: process.cwd(),
        env: { ...process.env, LANG: 'en_US.UTF-8' },
        windowsHide: true
      })
    } catch (error) {
      this.emit(sessionId, 'stderr', `终端启动失败: ${error instanceof Error ? error.message : String(error)}\r\n`)
      return
    }

    session.proc.stdout.on('data', (data: Buffer) => this.emit(sessionId, 'stdout', data.toString('utf-8')))
    session.proc.stderr.on('data', (data: Buffer) => this.emit(sessionId, 'stderr', data.toString('utf-8')))
    session.proc.on('error', (error) => this.emit(sessionId, 'stderr', `终端错误: ${error.message}\r\n`))
    session.proc.on('exit', (code) => {
      this.emit(sessionId, 'system', `\r\n[进程已退出，代码 ${code ?? '未知'}]\r\n`)
      session.proc = null
    })
  }

  /** 向指定会话写入命令 */
  write(sessionId: string, input: string): void {
    const session = this.sessions.get(sessionId)
    if (session?.proc && session.proc.stdin.writable) {
      session.proc.stdin.write(input)
    } else {
      this.emit(sessionId, 'stderr', '\r\n[终端未运行，请重新启动]\r\n')
    }
  }

  /** 终止并移除指定会话 */
  disposeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session?.proc) {
      session.proc.kill()
      session.proc = null
    }
    this.sessions.delete(sessionId)
  }

  /** 释放所有会话（窗口关闭时调用） */
  dispose(): void {
    for (const id of [...this.sessions.keys()]) {
      this.disposeSession(id)
    }
  }

  private emit(sessionId: string, kind: 'stdout' | 'stderr' | 'system', data: string): void {
    if (!this.sender.isDestroyed()) {
      this.sender.send('terminal:output', { sessionId, kind, data })
    }
  }
}

/** 注册终端相关 IPC（多会话） */
export function registerTerminalIpc(getTerminal: () => TerminalService | null): void {
  ipcMain.on('terminal:start', (_event, sessionId: string, shell?: ShellKind) => {
    if (typeof sessionId === 'string') {
      getTerminal()?.start(sessionId, shell ?? 'powershell')
    }
  })

  ipcMain.on('terminal:write', (_event, sessionId: string, input: string) => {
    if (typeof sessionId === 'string' && typeof input === 'string' && input.length <= 10000) {
      getTerminal()?.write(sessionId, input)
    }
  })

  ipcMain.on('terminal:dispose', (_event, sessionId: string) => {
    if (typeof sessionId === 'string') {
      getTerminal()?.disposeSession(sessionId)
    }
  })
}
