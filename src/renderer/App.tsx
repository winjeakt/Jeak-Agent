import { useEffect, useState } from 'react'
import FileTree from './components/FileTree/FileTree'
import Editor from './components/Editor/Editor'
import AIContextPanel from './components/Editor/AIContextPanel'
import ChatPanel from './components/ChatPanel/ChatPanel'
import ErrorBoundary from './components/ErrorBoundary'
import Onboarding from './components/Onboarding'
import { useI18nStore } from './stores/i18nStore'

export default function App(): JSX.Element {
  const setTheme = useI18nStore((s) => s.setTheme)
  const setLanguage = useI18nStore((s) => s.setLanguage)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // 初始化：读取主题 / 语言 / 引导状态 + 注册全局错误监听
  useEffect(() => {
    window.jeak.settings.get().then((settings) => {
      setTheme(settings.theme ?? 'dark')
      setLanguage(settings.language ?? 'zh')
      setShowOnboarding(!settings.onboarded)
      setInitialized(true)
    })
  }, [setTheme, setLanguage])

  // 全局错误监听（主进程致命错误）
  useEffect(() => {
    const unsub = window.jeak.onFatalError((message) => {
      console.error('[renderer] 主进程错误:', message)
      // 通过全局 toast 提示（若存在）
      window.dispatchEvent(new CustomEvent('jeak:fatal-error', { detail: message }))
    })
    return unsub
  }, [])

  const handleOnboardingComplete = async (): Promise<void> => {
    await window.jeak.settings.set({ onboarded: true })
    setShowOnboarding(false)
  }

  if (!initialized) return <div className="app-loading" />

  return (
    <ErrorBoundary>
      {showOnboarding && <Onboarding onComplete={() => void handleOnboardingComplete()} />}
      <div className="app-shell">
        <aside className="app-shell__filetree">
          <FileTree />
        </aside>
        <main className="app-shell__editor">
          <Editor />
          <AIContextPanel />
        </main>
        <aside className="app-shell__chat">
          <ChatPanel />
        </aside>
      </div>
    </ErrorBoundary>
  )
}
