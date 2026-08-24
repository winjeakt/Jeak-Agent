import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'
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
    const targetPath =
      typeof request?.filePath === 'string' && request.filePath
        ? ctx.resolveWithinAllowedRoot(request.filePath)
        : state?.path
          ? ctx.resolveWithinAllowedRoot(state.path)
          : null

    if (!targetPath) {
      throw new Error('未指定要 lint 的文件，且编辑器当前无打开文件')
    }
    if (!existsSync(targetPath)) {
      throw new Error(`目标文件不存在: ${targetPath}`)
    }

    // cwd 优先用项目根（解析 eslint 配置与 node_modules）
    const cwd =
      typeof request?.cwd === 'string' && request.cwd
        ? ctx.resolveWithinAllowedRoot(request.cwd)
        : (deps.getProjectRoot() ?? ctx.resolveWithinAllowedRoot('.'))

    const diagnostics = await runEslint(cwd, targetPath)
    return { filePath: targetPath, diagnostics }
  })
}

async function runEslint(cwd: string, targetPath: string): Promise<Diagnostic[]> {
  const localBin = join(cwd, 'node_modules', '.bin', process.platform === 'win32' ? 'eslint.cmd' : 'eslint')
  const eslintBin = existsSync(localBin) ? localBin : 'eslint'

  let stdout: string
  try {
    const result = await execFileAsync(eslintBin, [targetPath, '--format', 'json'], {
      cwd,
      maxBuffer: MAX_OUTPUT,
      timeout: 30000,
      windowsHide: true
    })
    stdout = result.stdout
  } catch (error) {
    // ESLint 发现问题时返回非零退出码，但 stdout 仍含 JSON 结果
    const e = error as { stdout?: string; stderr?: string }
    if (e.stdout) {
      stdout = e.stdout
    } else {
      throw new Error(`ESLint 执行失败: ${(e.stderr || '未知错误').slice(0, 500)}`)
    }
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
