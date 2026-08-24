import { ipcMain } from 'electron'
import { readFileSync, statSync, writeFileSync } from 'fs'
import type { PluginApiDeps } from './types'

/** 文件访问上限：读 5MB / 写 2MB（防止恶意插件拖垮主进程） */
const MAX_READ_SIZE = 5 * 1024 * 1024
const MAX_WRITE_SIZE = 2 * 1024 * 1024

/**
 * 插件 fs API：fs.readTextFile / fs.writeTextFile
 * 安全约束（主进程强制）：
 * - 路径解析后必须在允许根目录（插件目录 + 项目根）内，防止目录穿越
 * - 文件大小上限
 */
export function registerFsApi(deps: PluginApiDeps): void {
  ipcMain.handle('plugin:fs:read-text', (event, filePath: string) => {
    const ctx = deps.getContext(event)
    ctx.requirePermission('fs:read')
    const resolved = ctx.resolveWithinAllowedRoot(filePath)
    const stats = statSync(resolved)
    if (!stats.isFile()) throw new Error('目标不是文件')
    if (stats.size > MAX_READ_SIZE) throw new Error(`文件超过 ${MAX_READ_SIZE / 1024 / 1024}MB 读取上限`)
    return readFileSync(resolved, 'utf-8')
  })

  ipcMain.handle('plugin:fs:write-text', (event, filePath: string, content: string) => {
    const ctx = deps.getContext(event)
    ctx.requirePermission('fs:write')
    if (typeof content !== 'string') throw new Error('写入内容必须为字符串')
    if (content.length > MAX_WRITE_SIZE) throw new Error(`写入内容超过 ${MAX_WRITE_SIZE / 1024 / 1024}MB 上限`)
    const resolved = ctx.resolveWithinAllowedRoot(filePath)
    writeFileSync(resolved, content, 'utf-8')
    return { ok: true }
  })
}
