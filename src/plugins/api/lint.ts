import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join, resolve } from 'path'
import type { Diagnostic, LintRunRequest } from '../../shared/types'
import type { PluginApiDeps } from './types'

const execFileAsync = promisify(execFile)

/** eslint 输出上限 */
const MAX_OUTPUT = 5 * 1024 * 1024

/** ESLint JSON 输出消息结构 */
interface EslintMessage {
  ruleId: string | null
  severity: 1 | 2
  message: string
  line: number
  column: number
  endLine?: number
  endColumn?: number
}

interface EslintResult {
  filePath: string
  messages: EslintMessage[]
}

/**
 * 插件 lint API：lint.run
 * 主进程通过本地 node_modules 的 eslint 对文件执行 ESLint（JSON 输出），
 * 解析为结构化诊断列表返回。
 * 安全约束：
 * - 目标文件必须在插件允许根目录内
 * - eslint 二进制优先用项目本地 node_modules/.bin，避免全局污染
 * - 输出大小上限 + 超时
 */
export function registerLintApi(deps: PluginApiDeps): void {
  ipcMain.handle('plugin:lint:run', async (event, request: LintRunRequest) => {
    const ctx = deps.getContext(event)
    ctx.requirePermission('lint:run')

    const state = deps.getEditorState()
    const projectRoot = deps.getProjectRoot()

    // 目标文件：优先用插件显式传入的 filePath，否则用编辑器当前文件。
    // 安全约束：目标文件必须是"项目根目录内"的文件（受信任的项目范围），
    // 或等于编辑器当前打开的文件，防止插件 lint 任意系统文件。
    let targetPath: string | null = null
    if (typeof request?.filePath === 'string' && request.filePath) {
      const abs = resolve(request.filePath)
      if (projectRoot && ctx.isWithinRoots(abs, [projectRoot])) {
        targetPath = abs
      } else if (state?.path && resolve(state.path) === abs) {
        targetPath = abs
      } else {
        throw new Error(`拒绝访问：目标文件不在当前项目范围内（${abs}）`)
      }
    } else if (state?.path) {
      targetPath = state.path
    }

    if (!targetPath) {
      throw new Error('未指定要 lint 的文件，且编辑器当前无打开文件')
    }
    if (!existsSync(targetPath)) {
      throw new Error(`目标文件不存在: ${targetPath}`)
    }

    // cwd：优先用项目根（解析 eslint 配置与 node_modules），否则回退插件目录
    const cwd = projectRoot ?? ctx.resolveWithinAllowedRoot('.')

    const diagnostics = await runEslint(cwd, targetPath)
    return { filePath: targetPath, diagnostics }
  })
}

async function runEslint(cwd: string, targetPath: string): Promise<Diagnostic[]> {
  // 定位 eslint：优先项目本地 node_modules/eslint/bin/eslint.js（用 node 执行，避免 .cmd 在 Windows 的 spawn EINVAL）
  const localEslintJs = join(cwd, 'node_modules', 'eslint', 'bin', 'eslint.js')
  let command: string
  let args: string[]
  if (existsSync(localEslintJs)) {
    // 主进程是 Electron，process.execPath 指向 electron.exe；
    // 通过 ELECTRON_RUN_AS_NODE=1 让 Electron 以 Node 模式运行 eslint.js
    command = process.execPath
    args = [localEslintJs, targetPath, '--format', 'json']
    return runEslintWithNode(command, args, cwd)
  } else {
    // 回退：全局 eslint（Windows 用 .cmd 需 shell）
    command = process.platform === 'win32' ? 'eslint.cmd' : 'eslint'
    args = [targetPath, '--format', 'json']
    return runEslintGeneric(command, args, cwd, command.endsWith('.cmd'))
  }
}

async function runEslintWithNode(
  command: string,
  args: string[],
  cwd: string
): Promise<Diagnostic[]> {
  let stdout: string
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      maxBuffer: MAX_OUTPUT,
      timeout: 30000,
      windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    })
    stdout = result.stdout
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message?: string }
    if (e.stdout) stdout = e.stdout
    else throw new Error(`ESLint 执行失败: ${(e.stderr || e.message || '未知错误').slice(0, 500)}`)
  }
  return parseEslintJson(stdout)
}

async function runEslintGeneric(
  command: string,
  args: string[],
  cwd: string,
  useShell: boolean
): Promise<Diagnostic[]> {
  let stdout: string
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      maxBuffer: MAX_OUTPUT,
      timeout: 30000,
      windowsHide: true,
      shell: useShell
    })
    stdout = result.stdout
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message?: string }
    if (e.stdout) stdout = e.stdout
    else throw new Error(`ESLint 执行失败: ${(e.stderr || e.message || '未知错误').slice(0, 500)}`)
  }
  return parseEslintJson(stdout)
}

function parseEslintJson(stdout: string): Diagnostic[] {
  let results: EslintResult[]
  try {
    results = JSON.parse(stdout)
  } catch {
    throw new Error('无法解析 ESLint 输出（可能未安装 eslint）')
  }
  const diagnostics: Diagnostic[] = []
  for (const file of results) {
    for (const msg of file.messages) {
      if (!msg.message) continue
      diagnostics.push({
        severity: msg.severity === 2 ? 'error' : 'warning',
        message: msg.message,
        line: msg.line || 1,
        column: (msg.column || 1),
        endLine: msg.endLine,
        endColumn: msg.endColumn,
        ruleId: msg.ruleId ?? undefined,
        filePath: file.filePath
      })
    }
  }
  return diagnostics
}
