import { useEffect } from 'react'
import type { MarketPluginInfo, PluginInfo, PluginStatus } from '@shared/types'
import { usePluginStore } from '../../stores/pluginStore'
import { useT } from '../../stores/i18nStore'

const STATUS_KEY: Record<PluginStatus, 'plugins.status.ready' | 'plugins.status.disabled' | 'plugins.status.error'> = {
  ready: 'plugins.status.ready',
  disabled: 'plugins.status.disabled',
  error: 'plugins.status.error'
}

/** 插件管理面板：列出已安装插件、启用开关、权限与命令 */
export default function PluginManager(): JSX.Element {
  const t = useT()
  const plugins = usePluginStore((s) => s.plugins)
  const loading = usePluginStore((s) => s.loading)
  const error = usePluginStore((s) => s.error)
  const load = usePluginStore((s) => s.load)
  const toggle = usePluginStore((s) => s.toggle)
  const runCommand = usePluginStore((s) => s.runCommand)
  const uninstall = usePluginStore((s) => s.uninstall)
  const openDir = usePluginStore((s) => s.openDir)
  const applyList = usePluginStore((s) => s.applyList)
  const market = usePluginStore((s) => s.market)
  const marketLoading = usePluginStore((s) => s.marketLoading)
  const loadMarket = usePluginStore((s) => s.loadMarket)
  const installFromMarket = usePluginStore((s) => s.installFromMarket)
  const activeTab = usePluginStore((s) => s.activeTab)
  const setActiveTab = usePluginStore((s) => s.setActiveTab)

  useEffect(() => {
    void load()
    // 订阅主进程推送（启用/禁用、命令注册等实时变化）
    const unsubscribe = window.jeak.plugins.onChanged(applyList)
    return unsubscribe
  }, [load, applyList])

  // 切换到市场标签页时拉取市场列表
  useEffect(() => {
    if (activeTab === 'market') void loadMarket()
  }, [activeTab, loadMarket])

  return (
    <div className="plugins">
      <div className="plugins__toolbar">
        <div className="plugins__tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'installed'}
            className={`plugins__tab${activeTab === 'installed' ? ' plugins__tab--active' : ''}`}
            onClick={() => setActiveTab('installed')}
          >
            {t('plugins.tab.installed')}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'market'}
            className={`plugins__tab${activeTab === 'market' ? ' plugins__tab--active' : ''}`}
            onClick={() => setActiveTab('market')}
          >
            {t('plugins.tab.market')}
          </button>
        </div>
        <span className="plugins__count">
          {loading ? t('plugins.loading') : t('plugins.count', { count: plugins.length })}
        </span>
        <button className="ghost" onClick={() => void openDir()}>
          {t('plugins.openDir')}
        </button>
        <button className="ghost" onClick={() => void load()}>
          {t('plugins.refresh')}
        </button>
      </div>

      {error && <div className="plugin-card__error">{error}</div>}

      {activeTab === 'installed' && (
        <>
          {!loading && plugins.length === 0 && (
            <div className="empty-placeholder">
              <div className="empty-placeholder__icon">🧩</div>
              <div>{t('plugins.empty')}</div>
              <div style={{ fontSize: 12 }}>{t('plugins.refresh')}</div>
            </div>
          )}

          {plugins.map((plugin) => (
            <PluginCard
              key={plugin.name}
              plugin={plugin}
              onToggle={(enabled) => void toggle(plugin.name, enabled)}
              onRun={(command) => void runCommand(command)}
              onUninstall={() => void uninstall(plugin.name)}
            />
          ))}
        </>
      )}

      {activeTab === 'market' && (
        <>
          {!marketLoading && market.length === 0 && (
            <div className="empty-placeholder">
              <div className="empty-placeholder__icon">🛍️</div>
              <div>{t('plugins.market.empty')}</div>
            </div>
          )}

          {market.map((item) => (
            <MarketCard
              key={item.name}
              item={item}
              onInstall={() => void installFromMarket(item.name)}
            />
          ))}
        </>
      )}
    </div>
  )
}

function PluginCard({
  plugin,
  onToggle,
  onRun,
  onUninstall
}: {
  plugin: PluginInfo
  onToggle: (enabled: boolean) => void
  onRun: (command: string) => void
  onUninstall: () => void
}): JSX.Element {
  const t = useT()
  return (
    <div className={`plugin-card plugin-card--${plugin.status}`}>
      <div className="plugin-card__head">
        <div className="plugin-card__title">
          <span className="plugin-card__name">{plugin.name}</span>
          <span className="plugin-card__version">v{plugin.version}</span>
          <span className={`plugin-card__status plugin-card__status--${plugin.status}`}>
            {t(STATUS_KEY[plugin.status])}
          </span>
        </div>
        <label className="switch" title={plugin.enabled ? 'disable' : 'enable'}>
          <input
            type="checkbox"
            checked={plugin.enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="switch__slider" />
        </label>
      </div>

      <p className="plugin-card__desc">{plugin.description || '—'}</p>

      <div className="plugin-card__meta">
        <span>{plugin.author || ''}</span>
        <span>· {plugin.license || ''}</span>
      </div>

      {plugin.permissions.length > 0 && (
        <div className="plugin-card__permissions">
          {plugin.permissions.map((perm) => (
            <span key={perm} className="perm-chip" title={perm}>
              {perm}
            </span>
          ))}
        </div>
      )}

      {plugin.commands.length > 0 && (
        <div className="plugin-card__commands">
          {plugin.commands.map((cmd) => (
            <button
              key={cmd.command}
              className="plugin-card__run"
              disabled={!plugin.enabled}
              onClick={() => onRun(cmd.command)}
              title={cmd.command}
            >
              {t('plugins.run', { title: cmd.title })}
            </button>
          ))}
        </div>
      )}

      <div className="plugin-card__footer">
        <button
          className="plugin-card__uninstall"
          onClick={() => {
            if (window.confirm(t('plugins.uninstall.confirm', { name: plugin.name }))) {
              onUninstall()
            }
          }}
        >
          {t('plugins.uninstall')}
        </button>
      </div>

      {plugin.error && <div className="plugin-card__error">{plugin.error}</div>}
    </div>
  )
}

function MarketCard({
  item,
  onInstall
}: {
  item: MarketPluginInfo
  onInstall: () => void
}): JSX.Element {
  const t = useT()
  return (
    <div className="plugin-card">
      <div className="plugin-card__head">
        <div className="plugin-card__title">
          <span className="plugin-card__name">{item.name}</span>
          <span className="plugin-card__version">v{item.version}</span>
        </div>
        <button className="plugin-card__install" disabled={item.installed} onClick={onInstall}>
          {item.installed ? t('plugins.market.installed') : t('plugins.market.install')}
        </button>
      </div>
      <p className="plugin-card__desc">{item.description || '—'}</p>
      <div className="plugin-card__meta">
        <span>{item.author || ''}</span>
        <span>· {item.license || ''}</span>
      </div>
    </div>
  )
}
