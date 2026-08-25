import { create } from 'zustand'
import type { MarketPluginInfo, PluginInfo } from '@shared/types'

export type PluginTab = 'installed' | 'market'

interface PluginState {
  plugins: PluginInfo[]
  loading: boolean
  error: string | null
  /** 插件市场列表（含是否已安装） */
  market: MarketPluginInfo[]
  marketLoading: boolean
  /** 插件管理面板当前标签页 */
  activeTab: PluginTab
  /** 从主进程拉取插件列表 */
  load: () => Promise<void>
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
  /** 拉取插件市场列表 */
  loadMarket: () => Promise<void>
  /** 从插件市场安装插件 */
  installFromMarket: (name: string) => Promise<void>
  /** 切换插件管理标签页 */
  setActiveTab: (tab: PluginTab) => void
}

export const usePluginStore = create<PluginState>((set) => ({
  plugins: [],
  loading: false,
  error: null,
  market: [],
  marketLoading: false,
  activeTab: 'installed',

  load: async () => {
    set({ loading: true, error: null })
    try {
      const plugins = await window.jeak.plugins.list()
      set({ plugins, loading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
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

  applyList: (plugins) => set({ plugins }),

  loadMarket: async () => {
    set({ marketLoading: true, error: null })
    try {
      const market = await window.jeak.plugins.listMarket()
      set({ market, marketLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), marketLoading: false })
    }
  },

  installFromMarket: async (name) => {
    try {
      const plugins = await window.jeak.plugins.installFromMarket(name)
      set({ plugins })
      // 安装成功后刷新市场列表，更新 installed 标记
      const market = await window.jeak.plugins.listMarket()
      set({ market })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  },

  setActiveTab: (activeTab) => set({ activeTab })
}))
