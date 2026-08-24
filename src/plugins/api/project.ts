import { ipcMain } from 'electron'
import type { PluginApiDeps } from './types'

/** 插件 project API：project.get（Phase 3 暂无项目管理，根目录为空） */
export function registerProjectApi(deps: PluginApiDeps): void {
  ipcMain.handle('plugin:project:get', (event) => {
    const ctx = deps.getContext(event)
    ctx.requirePermission('project:get')
    return deps.getProjectInfo()
  })
}
