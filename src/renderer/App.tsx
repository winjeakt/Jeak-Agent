import { useEffect, useState } from 'react'
import FileTree from './components/FileTree/FileTree'
import Editor from './components/Editor/Editor'
import AIContextPanel from './components/Editor/AIContextPanel'
import ChatPanel from './components/ChatPanel/ChatPanel'
import ChatSettings from './components/ChatPanel/ChatSettings'
import TopBar from './components/TopBar/TopBar'
import SearchBox from './components/TopBar/SearchBox'
import ErrorBoundary from './components/ErrorBoundary'
import Onboarding from './components/Onboarding'
import ToastHost from './components/Toast/ToastHost'
import { useI18nStore } from './stores/i18nStore'
import { useLayoutStore } from './stores/layoutStore'
import { useUIStore } from './stores/uiStore'

export default function App(): JSX.Element {
  const setTheme = useI18nStore((s) => s.setTheme)
  const setLanguage = useI18nStore((s) => s.setLanguage)
  const setLayout = useLayoutStore((s) => s.setLayout)
  const showFileTree = useLayoutStore((s) => s.showFileTree)
  const showChat = useLayoutStore((s) => s.showChat)
  const showSettings = useUIStore((s) => s.showSettings)
  const closeSettings = useUIStore((s) => s.closeSettings)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // 初始化：读取主题 / 语言 / 布局 / 引导状态 + 注册全局错误监听
  useEffect(() => {
    window.jeak.settings.get().then((settings) => {
      setTheme(settings.theme ?? 'dark')
      setLanguage(settings.language ?? 'zh')
      if (settings.layout) {
        setLayout({
          showFileTree: settings.layout.showFileTree,
          showTerminal: settings.layout.showTerminal,
          showChat: settings.layout.showChat
        })
      }
      setShowOnboarding(!settings.onboarded)
      setInitialized(true)
    })
  }, [setTheme, setLanguage, setLayout])

  // 全局错误监听（主进程致命错误）
  useEffect(() => {
    const unsub = window.jeak.onFatalError((message) => {
      console.error('[renderer] 主进程错误:', message)
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
      <div className="app-root">
        <TopBar />
        <div className="app-shell">
          {showFileTree && (
            <aside className="app-shell__filetree">
              <FileTree />
            </aside>
          )}
          <main className="app-shell__editor">
            <Editor />
            <AIContextPanel />
          </main>
          {showChat && (
            <aside className="app-shell__chat">
              <ChatPanel />
            </aside>
          )}
        </div>
      </div>
      {showSettings && <ChatSettings onClose={closeSettings} />}
      <SearchBox />
      <ToastHost />
    </ErrorBoundary>
  )
}
