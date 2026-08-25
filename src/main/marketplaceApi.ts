import { ipcMain } from 'electron'
import type { AwesomePluginInfo, OfficialPluginEntry } from '../shared/types'
import { listAwesomeCopilotPlugins } from '../plugins/marketplace/marketplace-importer'
import officialIndex from '../../plugins-index.json'

/** 市场列表内存缓存 TTL：5 分钟 */
const CACHE_TTL_MS = 5 * 60 * 1000

let cache: { data: AwesomePluginInfo[]; ts: number } | null = null

/**
 * 注册「Awesome Copilot 在线市场」相关 IPC。
 * 列表接口 `plugins:awesome:list` 带 5 分钟内存缓存，命中时 0 次请求，
 * 拉取失败不缓存（避免缓存住错误态）。
 */
export function registerMarketIpc(): void {
  // 官方插件索引：构建时内联进主进程 bundle，无需网络请求
  ipcMain.handle(
    'plugins:official:list',
    (): OfficialPluginEntry[] => {
      const index = officialIndex as { version: number; plugins: OfficialPluginEntry[] }
      return index.plugins
    }
  )

  ipcMain.handle(
    'plugins:awesome:list',
    async (_e, force = false): Promise<AwesomePluginInfo[]> => {
      const now = Date.now()
      if (!force && cache && now - cache.ts < CACHE_TTL_MS) {
        return cache.data
      }
      const data = await listAwesomeCopilotPlugins()
      cache = { data, ts: now }
      return data
    }
  )
}
