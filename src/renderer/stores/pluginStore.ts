import { create } from 'zustand'
import type { PluginInfo } from '@shared/types'

interface PluginState {
  plugins: PluginInfo[]
  loading: boolean
  error: string | null
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
}

export const usePluginStore = create<PluginState>((set) => ({
  plugins: [],
  loading: false,
  error: null,

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

  applyList: (plugins) => set({ plugins })
}))
