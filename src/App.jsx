import { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import ChatView from './components/ChatView.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import { streamChat, generateImage } from './lib/api.js'
import { isImageModel } from './lib/models.js'
import {
  loadSettings,
  saveSettings,
  loadConversations,
  saveConversations,
  loadActiveId,
  saveActiveId,
} from './lib/storage.js'
import './App.css'

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function newConversation() {
  return { id: uid(), title: '新对话', messages: [], createdAt: Date.now() }
}

// 把内部消息格式转成 OpenAI 兼容的请求格式。
// 有图片时 content 必须是数组（multimodal）；没图片就是字符串。
function toApiMessage(m) {
  const imgs = m.images || []
  if (imgs.length === 0) {
    return { role: m.role, content: m.content || '' }
  }
  const parts = []
  if (m.content) parts.push({ type: 'text', text: m.content })
  for (const url of imgs) {
    parts.push({ type: 'image_url', image_url: { url } })
  }
  return { role: m.role, content: parts }
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [conversations, setConversations] = useState(() => {
    const list = loadConversations()
    return list.length ? list : [newConversation()]
  })
  const [activeId, setActiveId] = useState(() => {
    const saved = loadActiveId()
    const list = loadConversations()
    if (saved && list.some((c) => c.id === saved)) return saved
    return list[0]?.id ?? null
  })
  const [showSettings, setShowSettings] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef(null)

  useEffect(() => {
    if (!activeId && conversations[0]) setActiveId(conversations[0].id)
  }, [activeId, conversations])

  useEffect(() => {
    if (!settings.apiKey) setShowSettings(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => saveConversations(conversations), [conversations])
  useEffect(() => {
    if (activeId) saveActiveId(activeId)
  }, [activeId])
  useEffect(() => saveSettings(settings), [settings])

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  )

  function updateConversation(id, updater) {
    setConversations((list) =>
      list.map((c) => (c.id === id ? updater(c) : c)),
    )
  }

  function handleNew() {
    const c = newConversation()
    setConversations((list) => [c, ...list])
    setActiveId(c.id)
  }

  function handleDelete(id) {
    setConversations((list) => {
      const next = list.filter((c) => c.id !== id)
      if (next.length === 0) {
        const fresh = newConversation()
        setActiveId(fresh.id)
        return [fresh]
      }
      if (id === activeId) setActiveId(next[0].id)
      return next
    })
  }

  async function handleSend(text, images = []) {
    if (!active || isStreaming) return
    if (!text && images.length === 0) return

    const userMsg = { role: 'user', content: text, images }
    const assistantMsg = { role: 'assistant', content: '' }

    const newTitle =
      active.messages.length === 0
        ? text.slice(0, 20) || '[图片]'
        : active.title

    const history = [
      { role: 'system', content: settings.systemPrompt },
      ...active.messages
        .filter((m) => m.content || (m.images && m.images.length))
        .map(toApiMessage),
      toApiMessage(userMsg),
    ]

    updateConversation(active.id, (c) => ({
      ...c,
      title: newTitle,
      messages: [...c.messages, userMsg, assistantMsg],
    }))

    const controller = new AbortController()
    abortRef.current = controller
    setIsStreaming(true)
    const startedAt = Date.now()

    try {
      if (isImageModel(settings.model)) {
        // 图像生成：调用 /images/generations，把结果挂到 assistant 消息的 images 里
        updateConversation(active.id, (c) => {
          const msgs = c.messages.slice()
          msgs[msgs.length - 1] = { role: 'assistant', content: '正在生成图像…' }
          return { ...c, messages: msgs }
        })
        const url = await generateImage({
          settings,
          prompt: text,
          signal: controller.signal,
        })
        updateConversation(active.id, (c) => {
          const msgs = c.messages.slice()
          msgs[msgs.length - 1] = {
            role: 'assistant',
            content: '',
            images: [url],
            durationMs: Date.now() - startedAt,
          }
          return { ...c, messages: msgs }
        })
      } else {
        await streamChat({
          settings,
          messages: history,
          signal: controller.signal,
          onDelta: (_delta, full) => {
            updateConversation(active.id, (c) => {
              const msgs = c.messages.slice()
              msgs[msgs.length - 1] = { role: 'assistant', content: full }
              return { ...c, messages: msgs }
            })
          },
        })
        // 流式结束，把耗时写到最后一条 assistant 消息上
        updateConversation(active.id, (c) => {
          const msgs = c.messages.slice()
          const last = msgs[msgs.length - 1]
          msgs[msgs.length - 1] = {
            ...last,
            durationMs: Date.now() - startedAt,
          }
          return { ...c, messages: msgs }
        })
      }
    } catch (err) {
      const msg =
        err?.name === 'AbortError' ? '已停止' : err?.message || String(err)
      updateConversation(active.id, (c) => {
        const msgs = c.messages.slice()
        const last = msgs[msgs.length - 1]
        msgs[msgs.length - 1] = {
          ...last,
          error: msg,
          durationMs: Date.now() - startedAt,
        }
        return { ...c, messages: msgs }
      })
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  function handleStop() {
    abortRef.current?.abort()
  }

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNew}
        onDelete={handleDelete}
        onOpenSettings={() => setShowSettings(true)}
      />
      <ChatView
        conversation={active}
        isStreaming={isStreaming}
        onSend={handleSend}
        onStop={handleStop}
        onOpenSettings={() => setShowSettings(true)}
        needsApiKey={!settings.apiKey}
        model={settings.model}
        onModelChange={(m) => setSettings((s) => ({ ...s, model: m }))}
      />
      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
