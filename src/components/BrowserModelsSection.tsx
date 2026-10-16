import { useEffect, useState } from 'react'
import { Check, Download } from 'lucide-react'
import { BROWSER_MODELS } from '../lib/ai/browserModels'
import { ensureModel, isModelCached, requestPersistentStorage, webGPUAvailable } from '../lib/ai/webllm'
import { errorText } from '../lib/errors'

type Status = 'checking' | 'missing' | 'downloading' | 'cached'

// Lets the user download a browser model ahead of time, with progress
export function BrowserModelsSection() {
  const gpu = webGPUAvailable()
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [progress, setProgress] = useState<Record<string, { p: number; text: string }>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Check which models are already downloaded
  useEffect(() => {
    if (!gpu) return
    let cancelled = false
    const check = async () => {
      for (const m of BROWSER_MODELS) {
        let cached = false
        try {
          cached = await isModelCached(m.id)
        } catch {
          cached = false
        }
        if (!cancelled) setStatus((s) => ({ ...s, [m.id]: cached ? 'cached' : 'missing' }))
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [gpu])

  const download = async (id: string) => {
    setStatus((s) => ({ ...s, [id]: 'downloading' }))
    setErrors((e) => ({ ...e, [id]: '' }))
    await requestPersistentStorage()
    try {
      await ensureModel(id, (r) => setProgress((p) => ({ ...p, [id]: { p: r.progress, text: r.text } })))
      setStatus((s) => ({ ...s, [id]: 'cached' }))
    } catch (err) {
      setStatus((s) => ({ ...s, [id]: 'missing' }))
      setErrors((e) => ({ ...e, [id]: errorText(err) }))
    }
  }

  if (!gpu) {
    return (
      <p className="text-xs text-[#f85149]">
        This browser can't run models in the browser (WebGPU is not available). Use Chrome or Edge on a computer.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {BROWSER_MODELS.map((m) => {
        const s = status[m.id] ?? 'checking'
        const pr = progress[m.id]
        return (
          <div key={m.id} className="rounded-md border border-[#30363d] p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-[#e6edf3] truncate">
                  {m.label}
                  {m.experimental && <span className="ml-1.5 text-[10px] text-[#d29922]">experimental</span>}
                </p>
                <p className="text-[11px] text-[#8b949e]">
                  ~{m.approxGB} GB · {m.note}
                </p>
              </div>
              {s === 'cached' && (
                <span className="flex items-center gap-1 text-[11px] text-[#3fb950] shrink-0">
                  <Check size={12} /> Downloaded
                </span>
              )}
              {s === 'missing' && (
                <button
                  onClick={() => download(m.id)}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[#238636] hover:bg-[#2ea043] text-white shrink-0"
                >
                  <Download size={12} /> Download
                </button>
              )}
              {s === 'checking' && <span className="text-[11px] text-[#8b949e] shrink-0">Checking...</span>}
            </div>

            {s === 'downloading' && (
              <div className="mt-2">
                <div className="h-1.5 w-full rounded bg-[#21262d] overflow-hidden">
                  <div className="h-full bg-[#58a6ff] transition-all" style={{ width: `${Math.round((pr?.p ?? 0) * 100)}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-[#8b949e] truncate">
                  {Math.round((pr?.p ?? 0) * 100)}% · {pr?.text ?? 'Starting...'}
                </p>
              </div>
            )}

            {errors[m.id] && <p className="mt-1 text-[11px] text-[#f85149]">{errors[m.id]}</p>}
          </div>
        )
      })}
      <p className="text-[10px] text-[#8b949e]">
        Downloads are stored in this browser for this website. Clearing site data removes them.
      </p>
    </div>
  )
}