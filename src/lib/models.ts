import { BROWSER_MODELS } from './ai/browserModels'

export interface ModelOption {
  id: string // full id used in requests, e.g. "ollama/gemma4:e4b"
  label: string // display name
  provider: 'browser' | 'ollama' | 'openrouter' | 'groq'
  popular?: boolean
  isNew?: boolean
}

// Local models served by Ollama (run on your own machine, always free)
export const LOCAL_MODELS: ModelOption[] = [
  ...BROWSER_MODELS.map((m) => ({
    id: `browser/${m.id}`,
    label: m.experimental ? `${m.label} (experimental)` : m.label,
    provider: 'browser' as const,
    popular: m.popular,
  })),
  { id: 'ollama/gemma4:e4b', label: 'Gemma 4 E4B', provider: 'ollama', popular: true, isNew: true },
  { id: 'ollama/gemma4:e2b', label: 'Gemma 4 E2B', provider: 'ollama', isNew: true },
  { id: 'ollama/gemma4:26b', label: 'Gemma 4 26B', provider: 'ollama', isNew: true },
  { id: 'ollama/gemma4:31b', label: 'Gemma 4 31B', provider: 'ollama', isNew: true },
  { id: 'ollama/gemma2:9b', label: 'Gemma 2 9B', provider: 'ollama', popular: true },
  { id: 'ollama/qwen2.5-coder:7b', label: 'Qwen2.5-Coder 7B', provider: 'ollama', popular: true },
  { id: 'ollama/deepseek-coder-v2:16b', label: 'DeepSeek Coder V2 16B', provider: 'ollama' },
]

// Groq cloud models. Needs your Groq API key (see providers/keys.ts).
// Check model ids at console.groq.com/docs/models if one stops working.
export const GROQ_MODELS: ModelOption[] = [
  { id: 'groq/openai/gpt-oss-120b', label: 'GPT-OSS 120B (Groq)', provider: 'groq', popular: true },
  { id: 'groq/openai/gpt-oss-20b', label: 'GPT-OSS 20B (Groq, fastest)', provider: 'groq' },
]

// OpenRouter free models rotate often, so the full list is fetched live.
// Add model ids here (exactly as shown on openrouter.ai, e.g. "google/gemma-4-...:free")
// to pin them to the top of the popular list.
export const POPULAR_OPENROUTER_IDS: string[] = []

interface OpenRouterModel {
  id: string
  name: string
  pricing?: { prompt?: string; completion?: string }
}

// Public endpoint, no API key needed to list models.
// Keep only models that cost $0 per prompt and per completion token.
export async function fetchOpenRouterFreeModels(): Promise<ModelOption[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models')
  if (!res.ok) throw new Error(`OpenRouter responded ${res.status}`)
  const json = (await res.json()) as { data: OpenRouterModel[] }

  return json.data
    .filter((m) => m.pricing?.prompt === '0' && m.pricing?.completion === '0')
    .map((m) => ({
      id: `openrouter/${m.id}`,
      label: m.name,
      provider: 'openrouter' as const,
      popular: POPULAR_OPENROUTER_IDS.includes(`openrouter/${m.id}`),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}