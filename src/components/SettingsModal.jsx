import { useState } from 'react'

const PRESETS = [
  { label: 'OpenAI 官方', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
]

export default function SettingsModal({ settings, onChange, onClose }) {
  const [revealKey, setRevealKey] = useState(false)

  function update(patch) {
    onChange({ ...settings, ...patch })
  }

  function applyPreset(p) {
    update({ baseUrl: p.baseUrl, model: p.model })
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
              placeholder="https://api.openai.com/v1"
            />
            <div className="preset-row">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="preset-btn"
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>
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
