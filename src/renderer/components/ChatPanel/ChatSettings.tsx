import { useEffect, useState } from 'react'
import type { AIChatModel, AppLanguage, ShortcutSettings, Theme } from '@shared/types'
import { useChatStore } from '../../stores/chatStore'
import { useI18nStore, useT } from '../../stores/i18nStore'
import { useThemeStore } from '../../stores/themeStore'
import { useUIStore, type SettingsTab } from '../../stores/uiStore'
import PluginManager from '../PluginManager/PluginManager'
import { MODEL_OPTIONS } from '../../constants/models'

interface Props {
  onClose: () => void
}

/** 设置中心：通用 / AI / 快捷键 / 插件管理 */
export default function ChatSettings({ onClose }: Props): JSX.Element {
  const settingsTab = useUIStore((s) => s.settingsTab)
  const [tab, setTab] = useState<SettingsTab>(settingsTab ?? 'general')
  const t = useT()

  // 菜单栏可指定要打开的 tab（如"插件面板"跳转到 plugins）
  useEffect(() => {
    if (settingsTab) setTab(settingsTab)
  }, [settingsTab])

  const tabs: Array<{ key: SettingsTab; label: string }> = [
    { key: 'general', label: t('settings.tab.general') },
    { key: 'ai', label: t('settings.tab.ai') },
    { key: 'shortcuts', label: t('settings.tab.shortcuts') },
    { key: 'plugins', label: t('settings.tab.plugins') }
  ]

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-card settings-card--wide" onClick={(e) => e.stopPropagation()}>
        <div className="settings-card__tabs">
          {tabs.map((item) => (
            <button
              key={item.key}
              className={tab === item.key ? 'active' : ''}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {tab === 'general' && <GeneralSettingsTab />}
        {tab === 'ai' && <AiSettingsTab onClose={onClose} />}
        {tab === 'shortcuts' && <ShortcutsSettingsTab />}
        {tab === 'plugins' && <PluginManager />}
      </div>
    </div>
  )
}

/** 通用设置：主题 + 语言 */
function GeneralSettingsTab(): JSX.Element {
  const t = useT()
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const language = useI18nStore((s) => s.language)
  const setLanguage = useI18nStore((s) => s.setLanguage)

  // themeStore 内部已完成 DOM 切换 + i18nStore 同步 + 持久化
  const handleTheme = (value: Theme): void => {
    setTheme(value)
  }

  const handleLanguage = async (value: AppLanguage): Promise<void> => {
    setLanguage(value)
    await window.jeak.settings.set({ language: value })
  }

  return (
    <>
      <h3>{t('settings.tab.general')}</h3>
      <div className="settings-field">
        <label>{t('settings.theme')}</label>
        <select value={theme} onChange={(e) => handleTheme(e.target.value as Theme)}>
          <option value="dark">{t('settings.theme.dark')}</option>
          <option value="light">{t('settings.theme.light')}</option>
          <option value="system">{t('settings.theme.system')}</option>
        </select>
      </div>
      <div className="settings-field">
        <label>{t('settings.language')}</label>
        <select
          value={language}
          onChange={(e) => void handleLanguage(e.target.value as AppLanguage)}
        >
          <option value="zh">{t('settings.language.zh')}</option>
          <option value="en">{t('settings.language.en')}</option>
        </select>
      </div>
    </>
  )
}

/** AI 设置页：API Key、模型、温度、最大 Token */
function AiSettingsTab({ onClose }: Props): JSX.Element {
  const t = useT()
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState<AIChatModel>('deepseek-chat')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(8192)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.jeak.settings.get().then((settings) => {
      setApiKey(settings.ai.apiKey)
      setModel(settings.ai.model)
      setTemperature(settings.ai.temperature)
      setMaxTokens(settings.ai.maxTokens)
    })
  }, [])

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    const trimmed = apiKey.trim()
    await window.jeak.settings.set({
      ai: { apiKey: trimmed, model, temperature, maxTokens }
    })
    useChatStore.getState().setHasApiKey(Boolean(trimmed))
    setSaving(false)
    setSaved(true)
    setTimeout(onClose, 800)
  }

  return (
    <>
      <h3>{t('settings.tab.ai')}</h3>
      <div className="settings-field">
        <label>{t('settings.apiKey')}</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          autoFocus
        />
      </div>
      <div className="settings-field">
        <label>{t('settings.model')}</label>
        <select value={model} onChange={(e) => setModel(e.target.value as AIChatModel)}>
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}（{opt.description}）
            </option>
          ))}
        </select>
      </div>
      <div className="settings-field">
        <label>{t('settings.temperature')}: {temperature.toFixed(1)}</label>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={temperature}
          onChange={(e) => setTemperature(Number(e.target.value))}
        />
      </div>
      <div className="settings-field">
        <label>{t('settings.maxTokens')}</label>
        <input
          type="number"
          min={1}
          max={32768}
          value={maxTokens}
          onChange={(e) => setMaxTokens(Number(e.target.value))}
        />
      </div>
      <p className="settings-card__tip">{t('settings.tip')}</p>
      <div className="settings-card__actions">
        <button className="ghost" onClick={onClose} disabled={saving}>
          {t('settings.cancel')}
        </button>
        <button className="primary" onClick={() => void handleSave()} disabled={saving}>
          {saved ? t('settings.saved') : saving ? t('settings.saving') : t('settings.save')}
        </button>
      </div>
    </>
  )
}

/** 快捷键设置页：可自定义 */
function ShortcutsSettingsTab(): JSX.Element {
  const t = useT()
  const [shortcuts, setShortcuts] = useState<ShortcutSettings | null>(null)
  const [recording, setRecording] = useState<keyof ShortcutSettings | null>(null)

  useEffect(() => {
    window.jeak.settings.get().then((s) => setShortcuts(s.shortcuts))
  }, [])

  const saveShortcut = async (key: keyof ShortcutSettings, value: string): Promise<void> => {
    const next = { ...(shortcuts ?? {}), [key]: value } as ShortcutSettings
    setShortcuts(next)
    await window.jeak.settings.set({ shortcuts: next })
  }

  const handleKeyDown = (key: keyof ShortcutSettings, e: React.KeyboardEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const parts: string[] = []
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
    if (e.shiftKey) parts.push('Shift')
    if (e.altKey) parts.push('Alt')
    const code = e.key.length === 1 ? e.key.toUpperCase() : e.key
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) parts.push(code)
    const combo = parts.join('+')
    if (combo) {
      void saveShortcut(key, combo)
    }
    setRecording(null)
  }

  const fields: Array<{ key: keyof ShortcutSettings; label: string }> = [
    { key: 'explain', label: t('settings.shortcut.explain') },
    { key: 'send', label: t('settings.shortcut.send') },
    { key: 'settings', label: t('settings.shortcut.settings') }
  ]

  return (
    <>
      <h3>{t('settings.tab.shortcuts')}</h3>
      <p className="settings-card__tip">{t('settings.shortcut.hint')}</p>
      {shortcuts &&
        fields.map((field) => (
          <div className="settings-field" key={field.key}>
            <label>{field.label}</label>
            <input
              readOnly
              value={recording === field.key ? '请按下组合键…' : (shortcuts[field.key] ?? '')}
              onFocus={() => setRecording(field.key)}
              onKeyDown={(e) => handleKeyDown(field.key, e)}
              onBlur={() => setRecording(null)}
            />
          </div>
        ))}
    </>
  )
}
