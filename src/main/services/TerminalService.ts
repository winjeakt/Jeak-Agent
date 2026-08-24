import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { ipcMain, type WebContents } from 'electron'

/**
 * 终端服务：主进程通过 child_process.spawn 启动 shell 进程，
 * 通过 IPC 与渲染进程双向通信（stdin 输入、stdout/stderr 流式回传）。
 * 每个主窗口一个终端实例。
 *
 * Windows 使用 powershell.exe（UTF-8 输出，避免 cmd 的 GBK 乱码），
 * 其他平台使用 bash。
 */
export class TerminalService {
  private proc: ChildProcessWithoutNullStreams | null = null
  private readonly sender: WebContents

  constructor(sender: WebContents) {
    this.sender = sender
  }

  /** 启动 shell 进程 */
  start(): void {
    if (this.proc) return

    const isWin = process.platform === 'win32'
    const shell = isWin ? 'powershell.exe' : 'bash'
    const args = isWin
      ? ['-NoLogo', '-NoExit', '-Command', '-']
      : ['-i']

    try {
      this.proc = spawn(shell, args, {
        cwd: process.cwd(),
        env: { ...process.env, LANG: 'en_US.UTF-8' },
        windowsHide: true
      })
    } catch (error) {
      this.emit('stderr', `终端启动失败: ${error instanceof Error ? error.message : String(error)}\r\n`)
      return
    }

    this.proc.stdout.on('data', (data: Buffer) => {
      this.emit('stdout', data.toString('utf-8'))
    })

    this.proc.stderr.on('data', (data: Buffer) => {
      this.emit('stderr', data.toString('utf-8'))
    })

    this.proc.on('error', (error) => {
      this.emit('stderr', `终端错误: ${error.message}\r\n`)
    })

    this.proc.on('exit', (code) => {
      this.emit('system', `\r\n[进程已退出，代码 ${code ?? '未知'}]\r\n`)
      this.proc = null
    })
  }

  /** 向 shell 写入命令 */
  write(input: string): void {
    if (this.proc && this.proc.stdin.writable) {
      this.proc.stdin.write(input)
    } else {
      this.emit('stderr', '\r\n[终端未运行，请重新启动]\r\n')
    }
  }

  /** 终止终端进程 */
  dispose(): void {
    if (this.proc) {
      this.proc.kill()
      this.proc = null
    }
  }

  get isRunning(): boolean {
    return this.proc !== null
  }

  private emit(kind: 'stdout' | 'stderr' | 'system', data: string): void {
    if (!this.sender.isDestroyed()) {
      this.sender.send('terminal:output', { kind, data })
    }
  }
}

/** 注册终端相关 IPC（单终端实例，绑定主窗口） */
export function registerTerminalIpc(getTerminal: () => TerminalService | null): void {
  ipcMain.on('terminal:start', () => {
    getTerminal()?.start()
  })

  ipcMain.on('terminal:write', (_event, input: string) => {
    if (typeof input === 'string' && input.length <= 10000) {
      getTerminal()?.write(input)
    }
  })

  ipcMain.on('terminal:dispose', () => {
    getTerminal()?.dispose()
  })
}
