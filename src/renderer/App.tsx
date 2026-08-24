import FileTree from './components/FileTree/FileTree'
import Editor from './components/Editor/Editor'
import AIContextPanel from './components/Editor/AIContextPanel'
import ChatPanel from './components/ChatPanel/ChatPanel'

export default function App(): JSX.Element {
  return (
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
  )
}
