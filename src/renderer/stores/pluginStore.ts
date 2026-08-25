import { create } from 'zustand'
import type { AwesomePluginInfo, OfficialPluginEntry, PluginInfo } from '@shared/types'

export type PluginsTab = 'installed' | 'market'

interface PluginState {
  plugins: PluginInfo[]
  loading: boolean
  error: string | null
  /** 当前激活的 Tab */
  pluginsTab: PluginsTab
  /** 在线市场插件列表 */
  marketPlugins: AwesomePluginInfo[]
  marketLoading: boolean
  marketError: string | null
  /** 官方插件索引（精选 + 官方推荐，主进程内联数据） */
  officialPlugins: OfficialPluginEntry[]
  /** 正在安装中的插件显示名（用于按钮「安装中…」状态） */
  installingName: string | null
  /** 从主进程拉取插件列表 */
  load: () => Promise<void>
  /** 切换 Tab */
  setPluginsTab: (tab: PluginsTab) => void
  /** 拉取在线市场插件列表（force 为 true 时绕过主进程缓存强制刷新） */
  loadMarket: (force?: boolean) => Promise<void>
  /** 从在线市场安装插件（force 时覆盖已安装版本；成功刷新已安装列表，失败抛出异常） */
  installFromMarket: (plugin: AwesomePluginInfo, force?: boolean) => Promise<void>
  /** 拉取官方插件索引 */
  loadOfficial: () => Promise<void>
  /** 从官方索引安装插件（成功刷新已安装列表，失败抛出异常） */
  installFromOfficial: (plugin: OfficialPluginEntry) => Promise<void>
  /** 启用 / 禁用插件 */
  toggle: (name: string, enabled: boolean) => Promise<void>
  /** 触发插件命令 */
  runCommand: (command: string) => Promise<void>
  /** 卸载插件 */
  uninstall: (name: string) => Promise<void>
  /** 从本地目录安装插件 */
  installLocal: () => Promise<void>
  /** 创建新插件模板 */
  create: (name: string) => Promise<void>
  /** 打开插件目录 */
  openDir: () => Promise<void>
  /** 应用主进程推送的新列表 */
  applyList: (plugins: PluginInfo[]) => void
}

export const usePluginStore = create<PluginState>((set) => ({
  plugins: [],
  loading: false,
  error: null,
  pluginsTab: 'installed',
  marketPlugins: [],
  marketLoading: false,
  marketError: null,
  officialPlugins: [],
  installingName: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const plugins = await window.jeak.plugins.list()
      set({ plugins, loading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },

  setPluginsTab: (tab) => set({ pluginsTab: tab }),

  loadMarket: async (force = false) => {
    set({ marketLoading: true, marketError: null })
    try {
      const marketPlugins = await window.jeak.plugins.listAwesome(force)
      set({ marketPlugins, marketLoading: false })
    } catch (error) {
      set({
        marketError: error instanceof Error ? error.message : String(error),
        marketLoading: false
      })
    }
  },

  installFromMarket: async (plugin, force = false) => {
    set({ installingName: plugin.name })
    try {
      const plugins = await window.jeak.plugins.installFromGithub(plugin.url, force)
      set({ plugins, installingName: null })
    } catch (error) {
      set({ installingName: null })
      throw error
    }
  },

  loadOfficial: async () => {
    try {
      const officialPlugins = await window.jeak.plugins.listOfficial()
      set({ officialPlugins })
    } catch {
      // 官方索引为本地内联数据，几乎不会失败；失败时保持空列表
      set({ officialPlugins: [] })
    }
  },

  installFromOfficial: async (plugin) => {
    set({ installingName: plugin.name })
    try {
      const plugins = await window.jeak.plugins.installFromGithub(plugin.repo)
      set({ plugins, installingName: null })
    } catch (error) {
      set({ installingName: null })
      throw error
    }
  },

  toggle: async (name, enabled) => {
    try {
      const plugins = await window.jeak.plugins.toggle(name, enabled)
      set({ plugins })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  runCommand: async (command) => {
    try {
      await window.jeak.plugins.runCommand(command)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  uninstall: async (name) => {
    try {
      const plugins = await window.jeak.plugins.uninstall(name)
      set({ plugins })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  installLocal: async () => {
    try {
      const plugins = await window.jeak.plugins.installLocal()
      set({ plugins })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  },

  create: async (name) => {
    try {
      const plugins = await window.jeak.plugins.create(name)
      set({ plugins })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  },

  openDir: async () => {
    await window.jeak.plugins.openDir()
  },

  applyList: (plugins) => set({ plugins })
}))
