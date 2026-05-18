import { useEffect, useRef, useState } from 'react'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8 MB / 张

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

const MODEL_GROUPS = [
  {
    label: '旗舰 (最强)',
    options: [
      { value: 'gpt-5.5', label: 'GPT-5.5 · 最新旗舰' },
      { value: 'gpt-5.5-pro', label: 'GPT-5.5 Pro · 更高精度' },
      { value: 'gpt-5.4', label: 'GPT-5.4' },
      { value: 'gpt-5.4-pro', label: 'GPT-5.4 Pro' },
      { value: 'gpt-5', label: 'GPT-5 · 可调推理深度' },
    ],
  },
  {
    label: '经济型 (便宜快)',
    options: [
      { value: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
      { value: 'gpt-5.4-nano', label: 'GPT-5.4 nano · 最便宜' },
      { value: 'gpt-5-mini', label: 'GPT-5 mini' },
      { value: 'gpt-5-nano', label: 'GPT-5 nano' },
    ],
  },
  {
    label: '专用',
    options: [
      { value: 'gpt-5.3-codex', label: 'GPT-5.3 Codex · 代码 Agent' },
      { value: 'gpt-4.1', label: 'GPT-4.1 · 非推理最强' },
    ],
  },
]

const ALL_MODEL_VALUES = MODEL_GROUPS.flatMap((g) =>
  g.options.map((o) => o.value),
)

export default function ChatView({
  conversation,
  isStreaming,
  onSend,
  onStop,
  onOpenSettings,
  needsApiKey,
  model,
  onModelChange,
}) {
  const [input, setInput] = useState('')
  const [images, setImages] = useState([]) // [{ id, name, dataUrl }]
  const scrollRef = useRef(null)
  const taRef = useRef(null)
  const fileRef = useRef(null)

  const messages = conversation?.messages ?? []

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, isStreaming])

  function autoGrow(el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  async function attachFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) =>
      f.type.startsWith('image/'),
    )
    const next = []
    for (const f of files) {
      if (f.size > MAX_IMAGE_BYTES) {
        alert(`图片 "${f.name}" 超过 8MB，已跳过`)
        continue
      }
      try {
        const dataUrl = await fileToDataUrl(f)
        next.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: f.name,
          dataUrl,
        })
      } catch {
        alert(`读取 "${f.name}" 失败`)
      }
    }
    if (next.length) setImages((prev) => [...prev, ...next])
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    const files = []
    for (const it of items) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile()
        if (f) files.push(f)
      }
    }
    if (files.length) {
      e.preventDefault()
      attachFiles(files)
    }
  }

  function removeImage(id) {
    setImages((list) => list.filter((x) => x.id !== id))
  }

  function handleSubmit(e) {
    e?.preventDefault()
    const text = input.trim()
    if ((!text && images.length === 0) || isStreaming) return
    onSend(text, images.map((x) => x.dataUrl))
    setInput('')
    setImages([])
    if (taRef.current) taRef.current.style.height = 'auto'
  }

  function handleKeyDown(e) {
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.isComposing &&
      !e.nativeEvent.isComposing
    ) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <main className="chat-view">
      <header className="chat-header">
        <label className="model-picker" title="切换模型">
          <span className="model-picker-label">模型</span>
          <select
            value={model || ''}
            onChange={(e) => onModelChange(e.target.value)}
          >
            {model && !ALL_MODEL_VALUES.includes(model) && (
              <option value={model}>(自定义) {model}</option>
            )}
            {MODEL_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </header>
      <div className="messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="welcome">
            <h1>AI 聊天</h1>
            <p>输入文字或上传图片，开始对话。</p>
            {needsApiKey && (
              <button className="btn-primary" onClick={onOpenSettings}>
                先去设置 API Key
              </button>
            )}
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={'msg msg-' + m.role}>
              <div className="msg-avatar">{m.role === 'user' ? '你' : 'AI'}</div>
              <div className="msg-bubble">
                {m.images && m.images.length > 0 && (
                  <div className="msg-images">
                    {m.images.map((src, k) => (
                      <a
                        key={k}
                        href={src}
                        target="_blank"
                        rel="noreferrer"
                        className="msg-image"
                      >
                        <img src={src} alt="" />
                      </a>
                    ))}
                  </div>
                )}
                {m.content ||
                  (m.role === 'assistant' &&
                  isStreaming &&
                  i === messages.length - 1 ? (
                    <span className="cursor">▍</span>
                  ) : (
                    ''
                  ))}
                {m.error && <div className="msg-error">⚠ {m.error}</div>}
              </div>
            </div>
          ))
        )}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <div className="composer-box">
          {images.length > 0 && (
            <div className="attach-row">
              {images.map((img) => (
                <div className="attach-chip" key={img.id}>
                  <img src={img.dataUrl} alt={img.name} />
                  <button
                    type="button"
                    className="attach-del"
                    title="移除"
                    onClick={() => removeImage(img.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="composer-row">
            <button
              type="button"
              className="attach-btn"
              title="上传图片（也可直接粘贴）"
              onClick={() => fileRef.current?.click()}
              disabled={needsApiKey || isStreaming}
            >
              📎
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                attachFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <textarea
              ref={taRef}
              className="composer-input"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                autoGrow(e.target)
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                needsApiKey
                  ? '请先在设置里填入 API Key…'
                  : '发消息…（Enter 发送，Shift+Enter 换行，可粘贴图片）'
              }
              rows={1}
              disabled={needsApiKey}
            />
            {isStreaming ? (
              <button
                type="button"
                className="send-btn stop"
                onClick={onStop}
                title="停止"
              >
                ■
              </button>
            ) : (
              <button
                type="submit"
                className="send-btn"
                disabled={(!input.trim() && images.length === 0) || needsApiKey}
                title="发送"
              >
                ↑
              </button>
            )}
          </div>
        </div>
      </form>
    </main>
  )
}
