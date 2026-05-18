import { useState } from 'react'

export default function SettingsModal({ settings, onChange, onClose }) {
  const [revealKey, setRevealKey] = useState(false)

  function update(patch) {
    onChange({ ...settings, ...patch })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>设置 <span className="auto-saved">· 自动保存</span></h2>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span className="field-label">API Key</span>
            <div className="key-row">
              <input
                type={revealKey ? 'text' : 'password'}
                value={settings.apiKey}
                onChange={(e) => update({ apiKey: e.target.value })}
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setRevealKey((v) => !v)}
                title={revealKey ? '隐藏' : '显示'}
              >
                {revealKey ? '🙈' : '👁'}
              </button>
            </div>
            <small className="hint">实时保存到浏览器 localStorage，刷新不会丢；不会上传到任何服务器。</small>
          </label>

          <label className="field">
            <span className="field-label">接口地址 (Base URL)</span>
            <input
              type="text"
              value={settings.baseUrl}
              onChange={(e) => update({ baseUrl: e.target.value })}
              placeholder="/api/v1"
            />
            <small className="hint">
              默认 <code>/api/v1</code>，走本地反向代理（不直接调上游接口）。
              dev 上游由 <code>.env.local</code> 的 <code>VITE_API_TARGET</code> 决定，
              改完要重启 <code>npm run dev</code>。
            </small>
          </label>

          <label className="field">
            <span className="field-label">模型</span>
            <input
              type="text"
              value={settings.model}
              onChange={(e) => update({ model: e.target.value })}
              placeholder="gpt-4o-mini"
            />
          </label>

          <label className="field">
            <span className="field-label">系统提示词 (System Prompt)</span>
            <textarea
              rows={3}
              value={settings.systemPrompt}
              onChange={(e) => update({ systemPrompt: e.target.value })}
            />
          </label>

          <label className="field">
            <span className="field-label">
              Temperature：{Number(settings.temperature).toFixed(2)}
            </span>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={settings.temperature}
              onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
            />
          </label>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>完成</button>
        </div>
      </div>
    </div>
  )
}
