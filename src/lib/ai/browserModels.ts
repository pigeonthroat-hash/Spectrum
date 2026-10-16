// Models that run in the browser (WebLLM). Downloaded once, then cached by the browser.

export const GEMMA4_ID = 'gemma-4-E4B-it-q4f16_1-MLC'

// Community build of Gemma 4 E4B. Not an official WebLLM release, and not yet tested
// in every browser, so it's listed as experimental.
export const GEMMA4_MODEL_RECORD = {
  model: 'https://huggingface.co/welcoma/gemma-4-E4B-it-q4f16_1-MLC/resolve/main/',
  model_id: GEMMA4_ID,
  model_lib:
    'https://huggingface.co/welcoma/gemma-4-E4B-it-q4f16_1-MLC/resolve/main/libs/gemma-4-E4B-it-q4f16_1-MLC-webgpu.wasm',
}

export interface BrowserModel {
  id: string
  label: string
  approxGB: number
  note: string
  popular?: boolean
  experimental?: boolean
}

export const BROWSER_MODELS: BrowserModel[] = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 1B',
    approxGB: 0.7,
    note: 'Fastest. Good for phones and older laptops.',
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 3B',
    approxGB: 1.9,
    popular: true,
    note: 'Recommended for most laptops.',
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    label: 'Phi 3.5 mini',
    approxGB: 2.2,
    note: 'Larger model with stronger reasoning.',
  },
  {
    id: GEMMA4_ID,
    label: 'Gemma 4 E4B',
    approxGB: 4.0,
    experimental: true,
    note: 'Experimental. Large download, needs a strong GPU.',
  },
]