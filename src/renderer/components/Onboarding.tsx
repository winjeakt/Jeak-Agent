import { useState } from 'react'
import { useI18nStore, useT } from '../stores/i18nStore'
import type { AIChatModel } from '@shared/types'
import { MODEL_OPTIONS } from '../constants/models'

interface Props {
  onComplete: () => void
}

/** 首次启动引导页：介绍功能 + 可选配置 API Key */
export default function Onboarding({ onComplete }: Props): JSX.Element {
  const t = useT()
  const [showConfig, setShowConfig] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState<AIChatModel>('deepseek-chat')
  const [saving, setSaving] = useState(false)

  const handleFinish = async (): Promise<void> => {
    if (apiKey.trim()) {
      setSaving(true)
      await window.jeak.settings.set({
        ai: { apiKey: apiKey.trim(), model, temperature: 0.7, maxTokens: 8192 }
      })
      setSaving(false)
    }
    onComplete()
  }

  const handleSkip = (): void => {
    onComplete()
  }

  return (
    <div className="onboarding">
      <div className="onboarding__card">
        <div className="onboarding__logo">🛠️</div>
        <h1>{t('onboarding.welcome')}</h1>
        <p className="onboarding__subtitle">{t('onboarding.subtitle')}</p>

        <ul className="onboarding__features">
          <li>💬 {t('onboarding.feature1')}</li>
          <li>🧩 {t('onboarding.feature2')}</li>
          <li>🔒 {t('onboarding.feature3')}</li>
        </ul>

        {showConfig ? (
          <div className="onboarding__config">
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
          </div>
        ) : (
          <div className="onboarding__actions">
            <button className="primary" onClick={() => setShowConfig(true)}>
              {t('onboarding.config')}
            </button>
            <button className="ghost" onClick={handleSkip}>
              {t('onboarding.skip')}
            </button>
          </div>
        )}

        {showConfig && (
          <div className="onboarding__actions">
            <button className="primary" onClick={() => void handleFinish()} disabled={saving}>
              {saving ? t('settings.saving') : t('onboarding.start')}
            </button>
            <button className="ghost" onClick={handleSkip}>
              {t('onboarding.skip')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
