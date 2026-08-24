import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { GitDiffRequest, GitRunRequest } from '../../shared/types'
import type { PluginApiDeps } from './types'

const execFileAsync = promisify(execFile)

/** git 输出上限（防止恶意插件拖垮主进程内存） */
const MAX_OUTPUT = 2 * 1024 * 1024

/** 允许插件直接运行的 git 子命令白名单（安全：禁止任意命令注入） */
const ALLOWED_GIT_ARGS = new Set([
  'rev-parse',
  'branch',
  'status',
  'diff',
  'log',
  'show',
  'shortlog',
  'blame',
  'tag',
  'config',
  'remote',
  'ls-files'
])

/** 禁止的敏感参数前缀（防止读取凭据等） */
const FORBIDDEN_ARG_PREFIXES = ['credential', 'config', 'remote', '--exec-path']

/**
 * 插件 git API：git.diff / git.status / git.run
 * 安全约束：
 * - 仅允许白名单子命令，参数做危险标记过滤
 * - 输出大小上限 + 超时
 * - 工作目录必须在插件允许根目录内（见 resolveWithinAllowedRoot）
 */
export function registerGitApi(deps: PluginApiDeps): void {
  ipcMain.handle('plugin:git:diff', async (event, request: GitDiffRequest) => {
    const ctx = deps.getContext(event)
    ctx.requirePermission('git:diff')
    if (typeof request !== 'object' || request === null) throw new Error('无效的 git diff 请求')

    const cwd = resolveCwd(ctx, deps, request.cwd)
    const args =
      request.scope === 'staged'
        ? ['diff', '--cached', '--stat', '--patch']
        : ['diff', '--stat', '--patch']
    return runGit(cwd, args)
  })

  ipcMain.handle('plugin:git:status', async (event, request: { cwd?: string }) => {
    const ctx = deps.getContext(event)
    ctx.requirePermission('git:status')
    const cwd = resolveCwd(ctx, deps, request?.cwd)
    return runGit(cwd, ['status', '--short', '--branch'])
  })

  ipcMain.handle('plugin:git:run', async (event, request: GitRunRequest) => {
    const ctx = deps.getContext(event)
    ctx.requirePermission('git:run')
    if (typeof request !== 'object' || request === null || !Array.isArray(request.args)) {
      throw new Error('无效的 git 命令请求')
    }
    const args = request.args.map(String)
    if (args.length === 0) throw new Error('git 命令参数不能为空')
    if (!ALLOWED_GIT_ARGS.has(args[0])) {
      throw new Error(`不允许的 git 子命令: ${args[0]}`)
    }
    // 危险参数过滤
    for (const arg of args) {
      const lower = arg.toLowerCase()
      if (FORBIDDEN_ARG_PREFIXES.some((p) => lower.startsWith(p))) {
        throw new Error(`git 参数被拒绝: ${arg}`)
      }
    }
    const cwd = resolveCwd(ctx, deps, request.cwd)
    return runGit(cwd, args)
  })
}

function resolveCwd(
  ctx: import('../runtime/security').PluginSecurityContext,
  deps: PluginApiDeps,
  cwd?: string
): string {
  // 未指定 cwd 时，默认使用当前项目根目录（主进程从编辑器文件推导，受信任）
  if (!cwd) {
    const projectRoot = deps.getProjectRoot()
    if (projectRoot) return projectRoot
    // 回退：插件目录
    return ctx.resolveWithinAllowedRoot('.')
  }
  // 指定了 cwd：仅允许插件目录范围内（防止插件指定任意路径）
  return ctx.resolveWithinAllowedRoot(cwd)
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      maxBuffer: MAX_OUTPUT,
      timeout: 15000,
      windowsHide: true
    })
    return stdout.slice(0, MAX_OUTPUT)
  } catch (error) {
    const e = error as { message?: string; stdout?: string; stderr?: string; code?: number }
    if (e.stdout) return e.stdout.slice(0, MAX_OUTPUT)
    const detail = e.stderr || e.message || '未知错误'
    throw new Error(`git 执行失败: ${detail.slice(0, 500)}`)
  }
}
