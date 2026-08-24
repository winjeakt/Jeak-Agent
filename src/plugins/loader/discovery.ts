import { app } from 'electron'
import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/**
 * 插件发现器（Agent Plugins 1.0）
 * 扫描 ~/.jeak/plugins/ 目录下的所有插件子目录。
 * 规则：每个直接子目录若包含 plugin.json 即视为一个插件候选。
 */
export function getPluginsRoot(): string {
  return join(app.getPath('home'), '.jeak', 'plugins')
}

export interface DiscoveryResult {
  /** 插件根目录 */
  pluginsRoot: string
  /** 包含 plugin.json 的插件目录列表 */
  directories: string[]
}

export function discoverPluginDirectories(
  pluginsRoot: string = getPluginsRoot()
): DiscoveryResult {
  let directories: string[] = []
  try {
    directories = readdirSync(pluginsRoot)
      .filter((name) => !name.startsWith('.'))
      .map((name) => join(pluginsRoot, name))
      .filter((dir) => {
        try {
          return statSync(dir).isDirectory() && existsSync(join(dir, 'plugin.json'))
        } catch {
          return false
        }
      })
  } catch {
    // 根目录不存在（首次运行）时返回空列表，不视为错误
  }
  return { pluginsRoot, directories }
}
