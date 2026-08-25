import { useEffect } from 'react'
import { useT } from '../../stores/i18nStore'
import { usePluginStore } from '../../stores/pluginStore'
import { useUIStore } from '../../stores/uiStore'
import type { MenuItem } from './types'

/** "插件"菜单：管理 / 安装 / 已安装列表 / 更新 / 开发 */
export function usePluginsMenuItems(): MenuItem[] {
  const t = useT()
  const plugins = usePluginStore((s) => s.plugins)
  const load = usePluginStore((s) => s.load)
  const toggle = usePluginStore((s) => s.toggle)
  const installLocal = usePluginStore((s) => s.installLocal)
  const create = usePluginStore((s) => s.create)
  const setPluginsTab = usePluginStore((s) => s.setPluginsTab)
  const openSettings = useUIStore((s) => s.openSettings)

  useEffect(() => {
    if (plugins.length === 0) void load()
  }, [load, plugins.length])

  const handleInstallLocal = (): void => {
    installLocal().catch((error: unknown) => {
      window.alert(error instanceof Error ? error.message : String(error))
    })
  }

  const handleCreate = (): void => {
    const name = window.prompt(t('menu.plugins.create'), 'my-plugin')
    if (!name) return
    create(name).catch((error: unknown) => {
      window.alert(error instanceof Error ? error.message : String(error))
    })
  }

  const handleCheckUpdate = (): void => {
    void load()
    window.alert(t('menu.plugins.noMarket'))
  }

  const installedSubmenu: MenuItem[] =
    plugins.length > 0
      ? plugins.map((p) => ({
          id: `plugin-${p.name}`,
          label: `${p.name}（${p.enabled ? t('menu.plugins.enabled') : t('menu.plugins.disabled')}）`,
          checked: p.enabled,
          onClick: () => void toggle(p.name, !p.enabled)
        }))
      : [{ id: 'no-plugins', label: t('menu.plugins.installed'), disabled: true }]

  return [
    { id: 'manage', label: t('menu.plugins.manage'), shortcut: 'Ctrl+Shift+X', onClick: () => openSettings('plugins') },
    {
      id: 'install-market',
      label: t('menu.plugins.market'),
      onClick: () => {
        openSettings('plugins')
        setPluginsTab('market')
      }
    },
    { id: 'install-local', label: t('menu.plugins.installLocal'), onClick: handleInstallLocal },
    { id: 'sep-1', label: '', separator: true },
    { id: 'installed', label: t('menu.plugins.installed'), submenu: installedSubmenu },
    { id: 'sep-2', label: '', separator: true },
    { id: 'check-update', label: t('menu.plugins.checkUpdate'), onClick: handleCheckUpdate },
    { id: 'settings', label: t('menu.plugins.settings'), onClick: () => openSettings('plugins') },
    { id: 'create', label: t('menu.plugins.create'), onClick: handleCreate },
    {
      id: 'docs',
      label: t('menu.plugins.docs'),
      onClick: () => void window.jeak.shell.openExternal('https://github.com/winjeakt/Jeak-Agent')
    }
  ]
}
