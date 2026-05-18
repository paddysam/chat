// 文生图：POST /v1/images/generations，非流式，返回 1 张图
export async function generateImage({ settings, prompt, signal, size = '1024x1024' }) {
  const url = settings.baseUrl.replace(/\/+$/, '') + '/images/generations'
  const body = {
    model: settings.model,
    prompt,
    n: 1,
    size,
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`HTTP ${resp.status}: ${text || resp.statusText}`)
  }

  const json = await resp.json()
  const item = json?.data?.[0]
  if (!item) throw new Error('上游返回数据里没有图片')
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`
  if (item.url) return item.url
  throw new Error('未知的图片返回格式')
}

export async function streamChat({ settings, messages, signal, onDelta }) {
  const url = settings.baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const body = {
    model: settings.model,
    messages,
    stream: true,
    temperature: settings.temperature,
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`HTTP ${resp.status}: ${text || resp.statusText}`)
  }
  if (!resp.body) {
    throw new Error('响应没有 body，浏览器可能不支持流式读取')
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let full = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE 以 \n\n 分隔事件
    let idx
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') return full
        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            full += delta
            onDelta?.(delta, full)
          }
        } catch {
          // 不完整 JSON，忽略
        }
      }
    }
  }
  return full
}
