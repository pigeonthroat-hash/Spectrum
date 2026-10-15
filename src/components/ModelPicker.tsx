import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Loader2, Search } from 'lucide-react'
import { cn } from '../lib/utils'
import { LOCAL_MODELS, fetchOpenRouterFreeModels, type ModelOption } from '../lib/models'

interface ModelPickerProps {
  value: string
  onChange: (id: string) => void
  placement?: 'up' | 'down'
}

export function ModelPicker({ value, onChange, placement = 'down' }: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [remote, setRemote] = useState<ModelOption[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const rootRef = useRef<HTMLDivElement>(null)

  // Load the OpenRouter free list the first time the picker opens
  useEffect(() => {
    if (!open || status !== 'idle') return
    setStatus('loading')
    fetchOpenRouterFreeModels()
      .then((list) => {
        setRemote(list)
        setStatus('done')
      })
      .catch(() => setStatus('error'))
  }, [open, status])

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const all = useMemo(() => [...LOCAL_MODELS, ...remote], [remote])
  const current = all.find((m) => m.id === value)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      return all.filter((m) => `${m.label} ${m.id}`.toLowerCase().includes(q))
    }
    return all.filter((m) => m.popular)
  }, [all, query])

  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 bg-[#161b22] border border-[#30363d] text-xs text-[#e6edf3] rounded px-2 py-1 max-w-[160px] outline-none hover:border-[#58a6ff] focus:border-[#58a6ff]"
      >
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDown size={12} className="shrink-0 text-[#8b949e]" />
      </button>

      {open && (
        <div className={cn(
          'absolute right-0 w-72 z-50 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl overflow-hidden',
          placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
        )}>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#30363d]">
            <Search size={13} className="text-[#8b949e] shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models"
              className="w-full bg-transparent text-xs text-[#e6edf3] placeholder:text-[#8b949e] outline-none"
            />
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {!query.trim() && (
              <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wider text-[#8b949e]">
                Popular
              </div>
            )}

            {visible.map((m) => (
              <button
                key={m.id}
                onClick={() => pick(m.id)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-[#21262d]',
                  m.id === value ? 'text-white' : 'text-[#e6edf3]'
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{m.label}</span>
                  <span className="block truncate text-[10px] text-[#8b949e]">{m.id}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {m.isNew && (
                    <span className="text-[9px] px-1 rounded bg-[#1f6feb] text-white">NEW</span>
                  )}
                  <span className="text-[9px] text-[#8b949e]">
                    {m.provider === 'ollama' ? 'local' : 'free'}
                  </span>
                  {m.id === value && <Check size={12} className="text-[#3fb950]" />}
                </span>
              </button>
            ))}

            {status === 'loading' && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#8b949e]">
                <Loader2 size={12} className="animate-spin" /> Loading free models...
              </div>
            )}
            {status === 'error' && (
              <div className="px-3 py-2 text-xs text-[#f85149]">
                Couldn't load OpenRouter models. Local models still work.
              </div>
            )}
            {status === 'done' && visible.length === 0 && (
              <div className="px-3 py-2 text-xs text-[#8b949e]">No models match "{query}"</div>
            )}
          </div>

          <div className="px-3 py-1.5 border-t border-[#30363d] text-[10px] text-[#8b949e]">
            {status === 'done' ? `${all.length} models · type to search` : 'Type to search all models'}
          </div>
        </div>
      )}
    </div>
  )
}
