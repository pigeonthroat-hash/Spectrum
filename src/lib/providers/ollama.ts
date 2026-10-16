export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const OLLAMA_URL = 'http://localhost:11434'

// Streams a chat reply from a local Ollama model, calling onToken for each piece of text.
// model looks like "ollama/gemma4:e4b"; Ollama itself wants "gemma4:e4b".
export async function streamOllamaChat(opts: {
  model: string
  messages: ChatMessage[]
  onToken: (text: string) => void
  signal?: AbortSignal
  stop?: string[]
  maxTokens?: number
}): Promise<void> {
  const modelName = opts.model.replace(/^ollama\//, '')
  const options: Record<string, unknown> = {}
  if (opts.stop) options.stop = opts.stop
  if (opts.maxTokens) options.num_predict = opts.maxTokens

  let res: Response
  try {
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, messages: opts.messages, stream: true, options }),
      signal: opts.signal,
    })
  } catch {
    throw new Error("Can't reach Ollama at localhost:11434. Is it running? Start it with `ollama serve`.")
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `Ollama returned ${res.status}${detail ? `: ${detail}` : ''}. If the model isn't downloaded, run: ollama pull ${modelName}`
    )
  }
  if (!res.body) throw new Error('Ollama sent an empty response')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const handleLine = (line: string) => {
    if (!line.trim()) return
    const chunk = JSON.parse(line) as { message?: { content?: string }; error?: string }
    if (chunk.error) throw new Error(chunk.error)
    if (chunk.message?.content) opts.onToken(chunk.message.content)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    lines.forEach(handleLine)
  }
  handleLine(buffer)
}