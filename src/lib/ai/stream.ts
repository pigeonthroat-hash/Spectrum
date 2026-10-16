import { streamBrowserAI } from './webllm'
import { streamOllamaChat } from '../providers/ollama'
import { streamOpenAICompatible } from '../providers/openaiCompatible'
import { GROQ_PROXY_URL, getSignedInToken } from '../providers/groqProxy'

export interface TurnMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// Picks the right model backend from the model id
export async function streamModel(opts: {
  modelId: string
  messages: TurnMessage[]
  stop?: string[]
  maxTokens?: number
  signal?: AbortSignal
  onToken: (text: string) => void
}): Promise<void> {
  if (opts.modelId.startsWith('browser/')) {
    return streamBrowserAI({
      modelId: opts.modelId.slice('browser/'.length),
      messages: opts.messages,
      onToken: opts.onToken,
      signal: opts.signal,
      stop: opts.stop,
      maxTokens: opts.maxTokens,
    })
  }
  if (opts.modelId.startsWith('ollama/')) {
    return streamOllamaChat({
      model: opts.modelId,
      messages: opts.messages,
      onToken: opts.onToken,
      signal: opts.signal,
      stop: opts.stop,
      maxTokens: opts.maxTokens,
    })
  }
  if (opts.modelId.startsWith('groq/')) {
    return streamOpenAICompatible({
      baseUrl: GROQ_PROXY_URL,
      apiKey: await getSignedInToken(),
      providerName: 'Groq',
      model: opts.modelId.slice('groq/'.length),
      messages: opts.messages,
      onToken: opts.onToken,
      signal: opts.signal,
      stop: opts.stop,
      maxTokens: opts.maxTokens,
    })
  }
  throw new Error('This model is not connected yet. Pick a browser, Ollama, or Groq model.')
}