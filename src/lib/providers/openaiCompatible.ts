export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// Streams a reply from any OpenAI-compatible chat endpoint (Groq, OpenRouter, custom).
// Calls onToken for each piece of text.
export async function streamOpenAICompatible(opts: {
  baseUrl: string
  apiKey: string
  providerName: string
  model: string
  messages: ChatMessage[]
  onToken: (text: string) => void
  signal?: AbortSignal
  stop?: string[]
  maxTokens?: number
}): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${opts.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        stream: true,
        stop: opts.stop,
        max_tokens: opts.maxTokens,
      }),
      signal: opts.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return
    throw new Error(`Can't reach ${opts.providerName}. Check your internet connection.`)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    if (res.status === 401) {
      throw new Error(`${opts.providerName} rejected the API key. Check that it was copied correctly.`)
    }
    if (res.status === 429) {
      throw new Error(`${opts.providerName} rate limit reached. Wait a minute, or pick another model.`)
    }
    throw new Error(
      `${opts.providerName} returned ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`
    )
  }
  if (!res.body) throw new Error(`${opts.providerName} sent an empty response`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finished = false

  // Each server-sent line looks like: data: {...json...}  and the stream ends with data: [DONE]
  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return
    const data = trimmed.slice(5).trim()
    if (!data) return
    if (data === '[DONE]') {
      finished = true
      return
    }
    const chunk = JSON.parse(data) as {
      choices?: { delta?: { content?: string | null } }[]
      error?: { message?: string }
    }
    if (chunk.error) throw new Error(chunk.error.message ?? `${opts.providerName} error`)
    const text = chunk.choices?.[0]?.delta?.content
    if (text) opts.onToken(text)
  }

  try {
    while (!finished) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      lines.forEach(handleLine)
    }
    if (buffer) handleLine(buffer)
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return
    throw err
  }
}