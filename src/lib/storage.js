const KEYS = {
  settings: 'aichat.settings',
  conversations: 'aichat.conversations',
  activeId: 'aichat.activeId',
}

const DEFAULT_SETTINGS = {
  apiKey: '',
  // 走本地反向代理，dev 由 Vite proxy 转发到 VITE_API_TARGET。
  // 生产部署需在 nginx / caddy 把 /api/v1/* 反代到真实上游。
  baseUrl: '/api/v1',
  model: 'gpt-5.5',
  systemPrompt: '你是一个有帮助的 AI 助手，请用中文回答。',
  temperature: 0.7,
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) }
}

export function saveSettings(settings) {
  write(KEYS.settings, settings)
}

export function loadConversations() {
  return read(KEYS.conversations, [])
}

export function saveConversations(conversations) {
  write(KEYS.conversations, conversations)
}

export function loadActiveId() {
  return read(KEYS.activeId, null)
}

export function saveActiveId(id) {
  write(KEYS.activeId, id)
}
