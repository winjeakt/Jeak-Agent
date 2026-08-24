import { useEffect } from 'react'
import type { PluginInfo, PluginStatus } from '@shared/types'
import { usePluginStore } from '../../stores/pluginStore'

const STATUS_LABEL: Record<PluginStatus, string> = {
  ready: '运行中',
  disabled: '已禁用',
  error: '出错'
}

/** 插件管理面板：列出已安装插件、启用开关、权限与命令 */
export default function PluginManager(): JSX.Element {
  const plugins = usePluginStore((s) => s.plugins)
  const loading = usePluginStore((s) => s.loading)
  const error = usePluginStore((s) => s.error)
  const load = usePluginStore((s) => s.load)
  const toggle = usePluginStore((s) => s.toggle)
  const runCommand = usePluginStore((s) => s.runCommand)
  const uninstall = usePluginStore((s) => s.uninstall)
  const openDir = usePluginStore((s) => s.openDir)
  const applyList = usePluginStore((s) => s.applyList)

  useEffect(() => {
    void load()
    // 订阅主进程推送（启用/禁用、命令注册等实时变化）
    const unsubscribe = window.jeak.plugins.onChanged(applyList)
    return unsubscribe
  }, [load, applyList])

  return (
    <div className="plugins">
      <div className="plugins__toolbar">
        <span className="plugins__count">{loading ? '加载中…' : `${plugins.length} 个插件`}</span>
        <button className="ghost" onClick={() => void openDir()}>
          打开插件目录
        </button>
        <button className="ghost" onClick={() => void load()}>
          刷新
        </button>
      </div>

      {error && <div className="plugin-card__error">{error}</div>}

      {!loading && plugins.length === 0 && (
        <div className="empty-placeholder">
          <div className="empty-placeholder__icon">🧩</div>
          <div>~/.jeak/plugins 下暂无插件</div>
          <div style={{ fontSize: 12 }}>
            将插件目录（含 plugin.json）放入后点击刷新
          </div>
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
  return (
    <div className={`plugin-card plugin-card--${plugin.status}`}>
      <div className="plugin-card__head">
        <div className="plugin-card__title">
          <span className="plugin-card__name">{plugin.name}</span>
          <span className="plugin-card__version">v{plugin.version}</span>
          <span className={`plugin-card__status plugin-card__status--${plugin.status}`}>
            {STATUS_LABEL[plugin.status]}
          </span>
        </div>
        <label className="switch" title={plugin.enabled ? '禁用插件' : '启用插件'}>
          <input
            type="checkbox"
            checked={plugin.enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="switch__slider" />
        </label>
      </div>

      <p className="plugin-card__desc">{plugin.description || '（无描述）'}</p>

      <div className="plugin-card__meta">
        <span>作者 {plugin.author || '未知'}</span>
        <span>· {plugin.license || '无许可证'}</span>
      </div>

      {plugin.permissions.length > 0 && (
        <div className="plugin-card__permissions">
          {plugin.permissions.map((perm) => (
            <span key={perm} className="perm-chip" title="插件申请的系统权限">
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
              ▶ {cmd.title}
            </button>
          ))}
        </div>
      )}

      <div className="plugin-card__footer">
        <button
          className="plugin-card__uninstall"
          onClick={() => {
            if (window.confirm(`确认卸载插件「${plugin.name}」？将删除插件目录。`)) {
              onUninstall()
            }
          }}
        >
          卸载
        </button>
      </div>

      {plugin.error && <div className="plugin-card__error">{plugin.error}</div>}
    </div>
  )
}
