import { relative, resolve, sep } from 'path'
import type { PluginManifest, PluginPermission } from '../../shared/types'

/**
 * 插件安全上下文：把"某个插件窗口发来的 IPC"绑定到该插件的身份与权限。
 * 所有插件 API handler 都必须先通过它做鉴权与路径白名单校验。
 */
export class PluginSecurityContext {
  constructor(
    readonly pluginName: string,
    readonly pluginDir: string,
    readonly manifest: PluginManifest,
    /** 允许插件读写文件的根目录（插件目录 + 当前项目根等） */
    private readonly allowRoots: string[] = []
  ) {}

  /** 校验插件是否申请了指定权限；未申请 -> 拒绝 */
  requirePermission(permission: PluginPermission): void {
    if (!this.manifest.permissions.includes(permission)) {
      throw new Error(`插件 ${this.pluginName} 未申请权限 ${permission}，请求被拒绝`)
    }
  }

  /** 追加允许访问的根目录（如 Phase 4 打开项目后） */
  addAllowRoot(root: string): void {
    this.allowRoots.push(root)
  }

  getAllowRoots(): string[] {
    return [...this.allowRoots]
  }

  /**
   * 解析并校验文件路径：
   * 1. 解析为绝对路径（相对路径基于插件目录解析）
   * 2. 必须在允许根目录范围内（防目录穿越 / 任意文件读写）
   * 3. 返回规范化绝对路径
   */
  resolveWithinAllowedRoot(filePath: string): string {
    if (typeof filePath !== 'string' || filePath.length === 0) {
      throw new Error('文件路径不能为空')
    }
    const resolved = resolve(this.pluginDir, filePath)
    for (const root of this.allowRoots) {
      const rel = relative(root, resolved)
      if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
        return resolved
      }
    }
    throw new Error(
      `插件 ${this.pluginName} 尝试访问权限范围外的路径: ${resolved}（允许范围: ${this.allowRoots.join(', ') || '无'}）`
    )
  }
}

function isAbsolute(p: string): boolean {
  return p.startsWith(sep) || /^[A-Za-z]:[\\/]/.test(p)
}
