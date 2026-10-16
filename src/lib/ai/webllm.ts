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

// Forgets the loaded model so the next message loads it again
function forgetEngine() {
  const old = engine
  engine = null
  loadedModel = null
  loading = null
  if (old) void old.unload().catch(() => undefined)
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
    if (engine) forgetEngine()
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

// Phones and some laptops lose the GPU when the browser goes to the background.
// Those errors mean the loaded model is dead, so we reset it and explain.
function isGpuLostError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err)
  return /GPUBuffer|mapAsync|Instance reference|device.*lost|context.*lost|out of memory/i.test(text)
}

export async function streamBrowserAI(opts: {
  modelId: string
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  onToken: (text: string) => void
  signal?: AbortSignal
  stop?: string[]
  maxTokens?: number
}): Promise<void> {
  try {
    const eng = await ensureModel(opts.modelId)
    const stream = await eng.chat.completions.create({
      messages: opts.messages as ChatCompletionMessageParam[],
      stream: true,
      stop: opts.stop,
      max_tokens: opts.maxTokens,
    })
    for await (const chunk of stream) {
      if (opts.signal?.aborted) {
        await eng.interruptGenerate()
        break
      }
      const text = chunk.choices[0]?.delta?.content
      if (text) opts.onToken(text)
    }
  } catch (err) {
    if (isGpuLostError(err)) {
      forgetEngine()
      throw new Error(
        'The graphics connection was reset, which often happens when the browser is switched away from. Send your message again to reload the model.'
      )
    }
    throw err
  }
}