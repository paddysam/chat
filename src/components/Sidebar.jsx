export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onOpenSettings,
}) {
  return (
    <aside className="sidebar">
      <button className="new-chat" onClick={onNew}>
        <span>+</span> 新对话
      </button>

      <div className="conv-list">
        {conversations.length === 0 && (
          <div className="empty-tip">还没有对话</div>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={'conv-item' + (c.id === activeId ? ' active' : '')}
            onClick={() => onSelect(c.id)}
          >
            <span className="conv-title">{c.title || '新对话'}</span>
            <button
              className="conv-del"
              title="删除"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('删除这个对话？')) onDelete(c.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button className="settings-btn" onClick={onOpenSettings}>
        ⚙ 设置
      </button>
    </aside>
  )
}
