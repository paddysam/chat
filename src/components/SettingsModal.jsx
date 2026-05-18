import { useEffect, useState } from 'react'
import { getStorageInfo, evictOldestUntil } from '../lib/imageStore.js'

function fmtBytes(n) {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)} ${units[i]}`
}

export default function SettingsModal({ settings, onChange, onClose }) {
  const [revealKey, setRevealKey] = useState(false)
  const [storage, setStorage] = useState({ usage: 0, quota: 0, supported: false })
  const [clearing, setClearing] = useState(false)

  async function refreshStorage() {
    setStorage(await getStorageInfo())
  }

  useEffect(() => {
    refreshStorage()
  }, [])

  function update(patch) {
    onChange({ ...settings, ...patch })
  }

  async function handleClearOld() {
    if (!confirm('删除较老的图片直到用量回落到 50% 以下？')) return
    setClearing(true)
    try {
      await evictOldestUntil(0.5)
      await refreshStorage()
    } finally {
      setClearing(false)
    }
  }

  const usageRatio = storage.quota > 0 ? storage.usage / storage.quota : 0
  const usagePct = (usageRatio * 100).toFixed(1)
  const barClass =
    usageRatio > 0.9 ? 'storage-bar danger'
      : usageRatio > 0.7 ? 'storage-bar warn'
      : 'storage-bar'

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

          <div className="field">
            <span className="field-label">浏览器存储用量</span>
            {storage.supported ? (
              <>
                <div className={barClass}>
                  <div
                    className="storage-bar-fill"
                    style={{ width: `${Math.min(100, usageRatio * 100)}%` }}
                  />
                </div>
                <div className="storage-stats">
                  <span>
                    已用 <strong>{fmtBytes(storage.usage)}</strong> / 共{' '}
                    <strong>{fmtBytes(storage.quota)}</strong>
                    {' · '}{usagePct}%
                  </span>
                  <div className="storage-actions">
                    <button
                      type="button"
                      className="preset-btn"
                      onClick={refreshStorage}
                    >
                      刷新
                    </button>
                    <button
                      type="button"
                      className="preset-btn"
                      onClick={handleClearOld}
                      disabled={clearing}
                    >
                      {clearing ? '清理中…' : '清理旧图片'}
                    </button>
                  </div>
                </div>
                <small className="hint">
                  写图时如果用量超过 80% 会自动从最老的图片开始删，直到回落到 60%。
                </small>
              </>
            ) : (
              <small className="hint">当前浏览器不支持配额查询</small>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>完成</button>
        </div>
      </div>
    </div>
  )
}
