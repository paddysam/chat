// 图片走 IndexedDB（localStorage 5MB 装不下几张 PNG base64）。
// 对话消息里只持久化短小的 ID，渲染时通过 cache 拿到 data URL。

const DB_NAME = 'aichat'
const STORE = 'images'
const VERSION = 1

// 自动清理阈值：超过 EVICT_TRIGGER 就开始清，清到 EVICT_TARGET 以下
const EVICT_TRIGGER = 0.8
const EVICT_TARGET = 0.6

let dbPromise

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function withStore(mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const store = tx.objectStore(STORE)
        const result = fn(store)
        tx.oncomplete = () => resolve(result?.value ?? result)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export async function putImage(id, dataUrl) {
  await withStore('readwrite', (s) => s.put(dataUrl, id))
}

export async function deleteImage(id) {
  await withStore('readwrite', (s) => s.delete(id))
}

export async function getAllImages() {
  const out = new Map()
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (cursor) {
        out.set(cursor.key, cursor.value)
        cursor.continue()
      } else {
        resolve(out)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

async function getAllImageIds() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAllKeys()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

// 浏览器配额信息，结合 IndexedDB / Cache / localStorage 一起算
export async function getStorageInfo() {
  if (!navigator.storage?.estimate) {
    return { usage: 0, quota: 0, supported: false }
  }
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { usage, quota, supported: true }
  } catch {
    return { usage: 0, quota: 0, supported: false }
  }
}

// 按 ID（时间戳前缀）排序，从最老开始删，直到 usage/quota 落到 target 以下
// 返回被删的 ID 列表（让 caller 同步清掉内存 cache）
export async function evictOldestUntil(target = EVICT_TARGET) {
  const info = await getStorageInfo()
  if (!info.supported || info.quota === 0) return []
  if (info.usage / info.quota <= target) return []

  // ID 形如 idb:lt3k9b8x82 —— 用毫秒时间戳 toString(36)，ASCII 排序近似时间序
  const ids = (await getAllImageIds()).sort()
  const deleted = []
  for (const id of ids) {
    await deleteImage(id)
    deleted.push(id)
    const { usage, quota } = await getStorageInfo()
    if (quota === 0 || usage / quota <= target) break
  }
  return deleted
}

// 写图前先看看够不够；不够就先清，清完再写；写失败再兜底重试
export async function putImageSafe(id, dataUrl, onEvict) {
  const info = await getStorageInfo()
  let evictedNow = []

  if (info.supported && info.quota > 0 && info.usage / info.quota >= EVICT_TRIGGER) {
    evictedNow = await evictOldestUntil(EVICT_TARGET)
  }

  try {
    await putImage(id, dataUrl)
  } catch (err) {
    if (err && (err.name === 'QuotaExceededError' || /quota/i.test(String(err.message)))) {
      // 兜底：再用力清一轮，目标更激进 0.4
      const more = await evictOldestUntil(0.4)
      evictedNow = evictedNow.concat(more)
      await putImage(id, dataUrl)
    } else {
      throw err
    }
  }

  if (evictedNow.length && typeof onEvict === 'function') onEvict(evictedNow)
}

export function newImageId() {
  return (
    'idb:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  )
}

export function isImageId(s) {
  return typeof s === 'string' && s.startsWith('idb:')
}
