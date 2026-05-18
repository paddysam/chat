// 图片走 IndexedDB（localStorage 5MB 装不下几张 PNG base64）。
// 对话消息里只持久化短小的 ID，渲染时通过 cache 拿到 data URL。

const DB_NAME = 'aichat'
const STORE = 'images'
const VERSION = 1

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
  await openDB()
  return new Promise((resolve, reject) => {
    openDB().then((db) => {
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
  })
}

export function newImageId() {
  return (
    'idb:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  )
}

export function isImageId(s) {
  return typeof s === 'string' && s.startsWith('idb:')
}
