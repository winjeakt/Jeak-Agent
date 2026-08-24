export default function FileTree(): JSX.Element {
  return (
    <div className="panel">
      <div className="panel__header">
        <span>Explorer</span>
      </div>
      <div className="panel__body">
        <div className="empty-placeholder">
          <div className="empty-placeholder__icon">📂</div>
          <div>尚未打开项目</div>
          <div style={{ fontSize: 12 }}>Phase 3 将接入文件系统</div>
        </div>
      </div>
    </div>
  )
}
