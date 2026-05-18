const KEYS = {
  settings: 'aichat.settings',
  conversations: 'aichat.conversations',
  activeId: 'aichat.activeId',
}

const DEFAULT_SETTINGS = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
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
