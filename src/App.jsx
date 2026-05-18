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
import {
  putImage,
  getAllImages,
  newImageId,
  isImageId,
} from './lib/imageStore.js'
import './App.css'

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function newConversation() {
  return { id: uid(), title: '新对话', messages: [], createdAt: Date.now() }
}

// 把内部消息格式转成 OpenAI 兼容的请求格式。
// 有图片时 content 必须是数组（multimodal）；没图片就是字符串。
// 消息里的图片可能是 idb:xxx 引用，这里通过 cache 拿到真实 data URL。
function toApiMessage(m, imageCache) {
  const imgs = m.images || []
  if (imgs.length === 0) {
    return { role: m.role, content: m.content || '' }
  }
  const parts = []
  if (m.content) parts.push({ type: 'text', text: m.content })
  for (const ref of imgs) {
    const url = isImageId(ref) ? imageCache.get(ref) : ref
    if (!url) continue
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
  const [imageCache, setImageCache] = useState(() => new Map())
  const abortRef = useRef(null)

  // 启动时从 IndexedDB 加载所有图片到内存 cache
  useEffect(() => {
    getAllImages().then((m) => setImageCache(m)).catch(() => {})
  }, [])

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

  // 把一张 data URL 写入 IndexedDB + 内存 cache，返回引用 ID
  async function persistDataUrl(dataUrl) {
    const id = newImageId()
    try {
      await putImage(id, dataUrl)
    } catch {
      // IndexedDB 写失败也回退到把原始 dataUrl 当 src 用（这次会话内能显示，刷新丢）
      return dataUrl
    }
    setImageCache((prev) => {
      const next = new Map(prev)
      next.set(id, dataUrl)
      return next
    })
    return id
  }

  async function handleSend(text, images = []) {
    if (!active || isStreaming) return
    if (!text && images.length === 0) return

    // 把用户上传的图片落到 IndexedDB；持久化后只保留 ID
    const userImageRefs = []
    for (const dataUrl of images) {
      const ref = await persistDataUrl(dataUrl)
      userImageRefs.push(ref)
    }

    const userMsg = { role: 'user', content: text, images: userImageRefs }
    const assistantMsg = { role: 'assistant', content: '' }

    const newTitle =
      active.messages.length === 0
        ? text.slice(0, 20) || '[图片]'
        : active.title

    // 构造给 API 的 history，包含本次的 userMsg。需要 cache + 刚写入的本地映射
    const localResolve = new Map()
    images.forEach((dataUrl, i) => {
      const ref = userImageRefs[i]
      if (isImageId(ref)) localResolve.set(ref, dataUrl)
    })
    const cacheForApi = new Map([...imageCache, ...localResolve])

    const history = [
      { role: 'system', content: settings.systemPrompt },
      ...active.messages
        .filter((m) => m.content || (m.images && m.images.length))
        .map((m) => toApiMessage(m, cacheForApi)),
      toApiMessage(userMsg, cacheForApi),
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
        const ref = await persistDataUrl(url)
        updateConversation(active.id, (c) => {
          const msgs = c.messages.slice()
          msgs[msgs.length - 1] = {
            role: 'assistant',
            content: '',
            images: [ref],
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
        imageCache={imageCache}
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
