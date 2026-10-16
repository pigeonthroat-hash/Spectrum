import type { MLCEngineInterface, ChatCompletionMessageParam } from '@mlc-ai/web-llm'
import { GEMMA4_MODEL_RECORD } from './browserModels'

export interface LoadProgress {
  progress: number // 0 to 1
  text: string
}

let engine: MLCEngineInterface | null = null
let loadedModel: string | null = null
let loading: { modelId: string; promise: Promise<MLCEngineInterface> } | null = null

export function webGPUAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

// Official WebLLM models plus our Gemma 4 entry
async function buildAppConfig() {
  const webllm = await import('@mlc-ai/web-llm')
  return {
    ...webllm.prebuiltAppConfig,
    model_list: [...webllm.prebuiltAppConfig.model_list, GEMMA4_MODEL_RECORD],
  }
}

// Downloads (first time only) and loads a model. Calls onProgress while downloading.
export async function ensureModel(
  modelId: string,
  onProgress?: (p: LoadProgress) => void
): Promise<MLCEngineInterface> {
  if (!webGPUAvailable()) {
    throw new Error(
      "This browser can't run browser models (WebGPU is not available). Try Chrome or Edge on a computer, or pick an Ollama model."
    )
  }
  if (engine && loadedModel === modelId) return engine
  if (loading && loading.modelId === modelId) return loading.promise

  const promise = (async () => {
    const webllm = await import('@mlc-ai/web-llm')
    if (engine) {
      await engine.unload()
      engine = null
      loadedModel = null
    }
    const created = await webllm.CreateMLCEngine(modelId, {
      appConfig: await buildAppConfig(),
      initProgressCallback: (r) => onProgress?.({ progress: r.progress, text: r.text }),
    })
    engine = created
    loadedModel = modelId
    return created
  })()

  loading = { modelId, promise }
  try {
    return await promise
  } finally {
    loading = null
  }
}

// True if the model's files are already stored in this browser
export async function isModelCached(modelId: string): Promise<boolean> {
  const webllm = await import('@mlc-ai/web-llm')
  return webllm.hasModelInCache(modelId, await buildAppConfig())
}

// Asks the browser not to delete stored models when space runs low
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

export async function streamBrowserAI(opts: {
  modelId: string
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  onToken: (text: string) => void
  signal?: AbortSignal
}): Promise<void> {
  const eng = await ensureModel(opts.modelId)
  const stream = await eng.chat.completions.create({
    messages: opts.messages as ChatCompletionMessageParam[],
    stream: true,
  })
  for await (const chunk of stream) {
    if (opts.signal?.aborted) {
      await eng.interruptGenerate()
      break
    }
    const text = chunk.choices[0]?.delta?.content
    if (text) opts.onToken(text)
  }
}