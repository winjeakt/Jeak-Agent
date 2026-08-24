import { useEffect, useState } from 'react'
import type { AIChatModel } from '@shared/types'
import { useChatStore } from '../../stores/chatStore'
import PluginManager from '../PluginManager/PluginManager'

interface Props {
  onClose: () => void
}

const MODEL_OPTIONS: Array<{ value: AIChatModel; label: string }> = [
  { value: 'deepseek-chat', label: 'deepseek-chat（通用对话）' },
  { value: 'deepseek-reasoner', label: 'deepseek-reasoner（深度推理）' }
]

type SettingsTab = 'ai' | 'plugins'

/** 设置弹层：AI 设置 / 插件管理 */
export default function ChatSettings({ onClose }: Props): JSX.Element {
  const [tab, setTab] = useState<SettingsTab>('ai')

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-card settings-card--wide" onClick={(e) => e.stopPropagation()}>
        <div className="settings-card__tabs">
          <button className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>
            AI 设置
          </button>
          <button className={tab === 'plugins' ? 'active' : ''} onClick={() => setTab('plugins')}>
            插件管理
          </button>
        </div>
        {tab === 'ai' ? <AiSettingsTab onClose={onClose} /> : <PluginManager />}
      </div>
    </div>
  )
}

/** AI 设置页：配置 DeepSeek API Key 与模型 */
function AiSettingsTab({ onClose }: Props): JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState<AIChatModel>('deepseek-chat')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.jeak.settings.get().then((settings) => {
      setApiKey(settings.ai.apiKey)
      setModel(settings.ai.model)
    })
  }, [])

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    const trimmed = apiKey.trim()
    await window.jeak.settings.set({
      ai: { apiKey: trimmed, model, temperature: 0.7, maxTokens: 4096 }
    })
    useChatStore.getState().setHasApiKey(Boolean(trimmed))
    setSaving(false)
    setSaved(true)
    setTimeout(onClose, 800)
  }

  return (
    <>
      <h3>AI 设置</h3>
      <div className="settings-field">
        <label>DeepSeek API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          autoFocus
        />
      </div>
      <div className="settings-field">
        <label>模型</label>
        <select value={model} onChange={(e) => setModel(e.target.value as AIChatModel)}>
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <p className="settings-card__tip">
        API Key 由主进程加密存储，仅用于请求 DeepSeek 服务，不会暴露给渲染进程。
      </p>
      <div className="settings-card__actions">
        <button className="ghost" onClick={onClose} disabled={saving}>
          取消
        </button>
        <button className="primary" onClick={() => void handleSave()} disabled={saving}>
          {saved ? '已保存 ✓' : saving ? '保存中…' : '保存'}
        </button>
      </div>
    </>
  )
}
