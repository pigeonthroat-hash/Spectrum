import { streamBrowserAI } from './webllm'
import { streamOllamaChat } from '../providers/ollama'

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
  throw new Error('This model is not connected yet. Pick a browser or Ollama model.')
}