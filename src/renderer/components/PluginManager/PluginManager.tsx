import { useEffect, useMemo, useState } from 'react'
import type { AwesomePluginInfo, OfficialPluginEntry, PluginInfo, PluginStatus } from '@shared/types'
import { usePluginStore } from '../../stores/pluginStore'
import { useT } from '../../stores/i18nStore'
import { toast } from '../Toast/toastStore'

const STATUS_KEY: Record<PluginStatus, 'plugins.status.ready' | 'plugins.status.disabled' | 'plugins.status.error'> = {
  ready: 'plugins.status.ready',
  disabled: 'plugins.status.disabled',
  error: 'plugins.status.error'
}

/** 插件管理面板：已安装列表 + 在线市场（Awesome Copilot） */
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
  const pluginsTab = usePluginStore((s) => s.pluginsTab)
  const setPluginsTab = usePluginStore((s) => s.setPluginsTab)

  useEffect(() => {
    void load()
    // 订阅主进程推送（启用/禁用、命令注册等实时变化）
    const unsubscribe = window.jeak.plugins.onChanged(applyList)
    return unsubscribe
  }, [load, applyList])

  return (
    <div className="plugins">
      <div className="plugins__toolbar">
        <div className="plugins__tabs">
          <button
            className={`plugins__tab ${pluginsTab === 'installed' ? 'plugins__tab--active' : ''}`}
            onClick={() => setPluginsTab('installed')}
          >
            {t('plugins.tab.installed')}
          </button>
          <button
            className={`plugins__tab ${pluginsTab === 'market' ? 'plugins__tab--active' : ''}`}
            onClick={() => setPluginsTab('market')}
          >
            {t('plugins.tab.market')}
          </button>
        </div>

        {pluginsTab === 'installed' && (
          <>
            <span className="plugins__count">
              {loading ? t('plugins.loading') : t('plugins.count', { count: plugins.length })}
            </span>
            <button className="ghost" onClick={() => void openDir()}>
              {t('plugins.openDir')}
            </button>
            <button className="ghost" onClick={() => void load()}>
              {t('plugins.refresh')}
            </button>
          </>
        )}
      </div>

      {pluginsTab === 'installed' ? (
        <>
          {error && <div className="plugin-card__error">{error}</div>}

          {!loading && plugins.length === 0 && (
            <div className="empty-placeholder">
              <div className="empty-placeholder__icon">🧩</div>
              <div>{t('plugins.empty')}</div>
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
      ) : (
        <MarketView />
      )}
    </div>
  )
}

/** 在线市场视图：官方推荐（精选置顶）+ 社区市场（Awesome Copilot），支持搜索 / 刷新 / 安装 / 更新 */
function MarketView(): JSX.Element {
  const t = useT()
  const plugins = usePluginStore((s) => s.plugins)
  const marketPlugins = usePluginStore((s) => s.marketPlugins)
  const marketLoading = usePluginStore((s) => s.marketLoading)
  const marketError = usePluginStore((s) => s.marketError)
  const installingName = usePluginStore((s) => s.installingName)
  const loadMarket = usePluginStore((s) => s.loadMarket)
  const installFromMarket = usePluginStore((s) => s.installFromMarket)
  const officialPlugins = usePluginStore((s) => s.officialPlugins)
  const loadOfficial = usePluginStore((s) => s.loadOfficial)
  const installFromOfficial = usePluginStore((s) => s.installFromOfficial)
  const [query, setQuery] = useState('')

  useEffect(() => {
    void loadMarket()
    void loadOfficial()
  }, [loadMarket, loadOfficial])

  const installedMap = useMemo(() => new Map(plugins.map((p) => [p.name, p.version])), [plugins])

  const officialNames = useMemo(
    () => new Set(officialPlugins.map((p) => p.name)),
    [officialPlugins]
  )

  const communityPlugins = useMemo(
    () => marketPlugins.filter((p) => !officialNames.has(p.name)),
    [marketPlugins, officialNames]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return communityPlugins
    return communityPlugins.filter((p) => p.name.toLowerCase().includes(q))
  }, [communityPlugins, query])

  const featured = useMemo(() => officialPlugins.filter((p) => p.featured), [officialPlugins])
  const recommended = useMemo(() => officialPlugins.filter((p) => !p.featured), [officialPlugins])

  const handleInstall = async (plugin: AwesomePluginInfo, force: boolean): Promise<void> => {
    try {
      await installFromMarket(plugin, force)
      toast.success(
        t(force ? 'plugins.market.updateSuccess' : 'plugins.market.installSuccess', {
          name: plugin.name
        })
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(
        t(force ? 'plugins.market.updateFail' : 'plugins.market.installFail', { error: message })
      )
    }
  }

  const handleInstallOfficial = async (plugin: OfficialPluginEntry): Promise<void> => {
    try {
      await installFromOfficial(plugin)
      toast.success(t('plugins.market.installSuccess', { name: plugin.name }))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(t('plugins.market.installFail', { error: message }))
    }
  }

  const hasOfficial = officialPlugins.length > 0
  const hasCommunity = communityPlugins.length > 0

  if (marketLoading && marketPlugins.length === 0 && !hasOfficial) {
    return (
      <div className="empty-placeholder">
        <div className="empty-placeholder__icon">⏳</div>
        <div>{t('plugins.market.loading')}</div>
      </div>
    )
  }

  if (marketError && marketPlugins.length === 0 && !hasOfficial) {
    return (
      <div className="empty-placeholder">
        <div className="empty-placeholder__icon">⚠️</div>
        <div>{marketError}</div>
        <button className="ghost" onClick={() => void loadMarket(true)}>
          {t('plugins.market.retry')}
        </button>
      </div>
    )
  }

  if (!hasOfficial && !hasCommunity) {
    return (
      <div className="empty-placeholder">
        <div className="empty-placeholder__icon">🧩</div>
        <div>{t('plugins.market.empty')}</div>
        <button className="ghost" onClick={() => void loadMarket(true)}>
          {t('plugins.market.refresh')}
        </button>
      </div>
    )
  }

  return (
    <div className="market">
      <div className="market-toolbar">
        <input
          className="market-search"
          type="search"
          placeholder={t('plugins.market.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="ghost market-refresh"
          disabled={marketLoading}
          onClick={() => void loadMarket(true)}
        >
          {marketLoading ? t('plugins.market.loading') : t('plugins.market.refresh')}
        </button>
      </div>

      {hasOfficial && (
        <section className="official-section">
          <h3 className="official-section__title">{t('plugins.market.officialTitle')}</h3>
          {featured.map((plugin) => (
            <OfficialCard
              key={plugin.name}
              plugin={plugin}
              featured
              installed={installedMap.has(plugin.name)}
              installing={installingName === plugin.name}
              onInstall={() => void handleInstallOfficial(plugin)}
            />
          ))}
          {recommended.map((plugin) => (
            <OfficialCard
              key={plugin.name}
              plugin={plugin}
              featured={false}
              installed={installedMap.has(plugin.name)}
              installing={installingName === plugin.name}
              onInstall={() => void handleInstallOfficial(plugin)}
            />
          ))}
        </section>
      )}

      {filtered.length === 0 ? (
        hasCommunity ? (
          <div className="empty-placeholder">
            <div className="empty-placeholder__icon">🔍</div>
            <div>{t('plugins.market.noMatch')}</div>
          </div>
        ) : null
      ) : (
        <div className="market-list">
          {filtered.map((plugin) => {
            const installedVersion = installedMap.get(plugin.name)
            const installed = installedVersion !== undefined
            const hasUpdate = installed && !!plugin.version && plugin.version !== installedVersion
            return (
              <MarketCard
                key={plugin.folder}
                plugin={plugin}
                installed={installed}
                hasUpdate={hasUpdate}
                installing={installingName === plugin.name}
                onInstall={() => void handleInstall(plugin, hasUpdate)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function MarketCard({
  plugin,
  installed,
  hasUpdate,
  installing,
  onInstall
}: {
  plugin: AwesomePluginInfo
  installed: boolean
  hasUpdate: boolean
  installing: boolean
  onInstall: () => void
}): JSX.Element {
  const t = useT()
  const disabled = installing || (installed && !hasUpdate)
  const label = installing
    ? t('plugins.market.installing')
    : hasUpdate
      ? t('plugins.market.update')
      : installed
        ? t('plugins.market.installed')
        : t('plugins.market.install')
  const buttonClass = hasUpdate
    ? 'plugin-card__install plugin-card__install--update'
    : installed
      ? 'plugin-card__install plugin-card__install--installed'
      : 'plugin-card__install'
  return (
    <div className="plugin-card plugin-card--market">
      <div className="plugin-card__head">
        <div className="plugin-card__title">
          <span className="plugin-card__name">{plugin.name}</span>
          {plugin.version && <span className="plugin-card__version">v{plugin.version}</span>}
          {plugin.pending && (
            <span className="plugin-card__pending">{t('plugins.market.pending')}</span>
          )}
        </div>
      </div>

      <p className="plugin-card__desc">
        {plugin.description || (plugin.pending ? t('plugins.market.pendingHint') : '—')}
      </p>

      <div className="plugin-card__meta">
        <span className="plugin-card__source">{t('plugins.market.sourceLabel')}</span>
      </div>

      <div className="plugin-card__footer">
        <button className={buttonClass} disabled={disabled} onClick={onInstall}>
          {label}
        </button>
      </div>
    </div>
  )
}

/** 官方插件卡片：展示精选/认证徽标，安装走 repo 地址 */
function OfficialCard({
  plugin,
  featured,
  installed,
  installing,
  onInstall
}: {
  plugin: OfficialPluginEntry
  featured: boolean
  installed: boolean
  installing: boolean
  onInstall: () => void
}): JSX.Element {
  const t = useT()
  const disabled = installing || installed
  const label = installing
    ? t('plugins.market.installing')
    : installed
      ? t('plugins.market.installed')
      : t('plugins.market.install')
  const buttonClass = installed
    ? 'plugin-card__install plugin-card__install--installed'
    : 'plugin-card__install'
  return (
    <div className={`plugin-card plugin-card--market${featured ? ' plugin-card--featured' : ''}`}>
      <div className="plugin-card__head">
        <div className="plugin-card__title">
          <span className="plugin-card__name">{plugin.name}</span>
          {featured && (
            <span className="plugin-card__featured">{t('plugins.market.featured')}</span>
          )}
          {plugin.verified && (
            <span className="plugin-card__verified">{t('plugins.market.verified')}</span>
          )}
        </div>
      </div>

      <p className="plugin-card__desc">{plugin.description || '—'}</p>

      <div className="plugin-card__meta">
        <span>{plugin.author || ''}</span>
        {plugin.category && <span>· {plugin.category}</span>}
      </div>

      <div className="plugin-card__footer">
        <button className={buttonClass} disabled={disabled} onClick={onInstall}>
          {label}
        </button>
      </div>
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
