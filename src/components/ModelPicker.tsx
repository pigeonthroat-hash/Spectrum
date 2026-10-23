import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Loader2, Search } from 'lucide-react'
import { cn } from '../lib/utils'
import { LOCAL_MODELS, GROQ_MODELS, fetchOpenRouterFreeModels, type ModelOption } from '../lib/models'

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

  const all = useMemo(() => [...LOCAL_MODELS, ...GROQ_MODELS, ...remote], [remote])
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
        className="flex items-center gap-1 bg-[#15130f] border border-[#2d2921] text-xs text-[#ece6da] rounded px-2 py-1 max-w-[160px] outline-none hover:border-[#f0a93b] focus:border-[#f0a93b]"
      >
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDown size={12} className="shrink-0 text-[#938a7c]" />
      </button>

      {open && (
        <div className={cn(
          'absolute right-0 w-72 z-50 bg-[#15130f] border border-[#2d2921] rounded-lg shadow-xl overflow-hidden',
          placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
        )}>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2d2921]">
            <Search size={13} className="text-[#938a7c] shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models"
              className="w-full bg-transparent text-xs text-[#ece6da] placeholder:text-[#938a7c] outline-none"
            />
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {!query.trim() && (
              <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wider text-[#938a7c]">
                Popular
              </div>
            )}

            {visible.map((m) => (
              <button
                key={m.id}
                onClick={() => pick(m.id)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-[#2a261f]',
                  m.id === value ? 'text-white' : 'text-[#ece6da]'
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{m.label}</span>
                  <span className="block truncate text-[10px] text-[#938a7c]">{m.id}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {m.isNew && (
                    <span className="text-[9px] px-1 rounded bg-[#1f6feb] text-white">NEW</span>
                  )}
                  <span className="text-[9px] text-[#938a7c]">
                    {m.provider === 'browser' ? 'browser' : m.provider === 'ollama' ? 'local' : 'free'}
                  </span>
                  {m.id === value && <Check size={12} className="text-[#f0a93b]" />}
                </span>
              </button>
            ))}

            {status === 'loading' && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#938a7c]">
                <Loader2 size={12} className="animate-spin" /> Loading free models...
              </div>
            )}
            {status === 'error' && (
              <div className="px-3 py-2 text-xs text-[#f85149]">
                Couldn't load OpenRouter models. Local models still work.
              </div>
            )}
            {status === 'done' && visible.length === 0 && (
              <div className="px-3 py-2 text-xs text-[#938a7c]">No models match "{query}"</div>
            )}
          </div>

          <div className="px-3 py-1.5 border-t border-[#2d2921] text-[10px] text-[#938a7c]">
            {status === 'done' ? `${all.length} models · type to search` : 'Type to search all models'}
          </div>
        </div>
      )}
    </div>
  )
}