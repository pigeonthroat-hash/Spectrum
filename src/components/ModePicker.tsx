import { useEffect, useRef, useState } from 'react'
import { Bug, Check, ChevronDown, Infinity as InfinityIcon, ListChecks, MessageSquare } from 'lucide-react'
import { cn } from '../lib/utils'
import type { AgentMode } from '../store/useAppStore'

const MODES: { id: AgentMode; label: string; icon: typeof InfinityIcon }[] = [
  { id: 'agent', label: 'Agent', icon: InfinityIcon },
  { id: 'plan', label: 'Plan', icon: ListChecks },
  { id: 'debug', label: 'Debug', icon: Bug },
  { id: 'ask', label: 'Ask', icon: MessageSquare },
]

interface ModePickerProps {
  value: AgentMode
  onChange: (mode: AgentMode) => void
  placement?: 'up' | 'down'
  askOnly?: boolean
}

export function ModePicker({ value, onChange, placement = 'up', askOnly = false }: ModePickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const current = MODES.find((m) => m.id === value) ?? MODES[0]
  const Icon = current.icon

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-[#ece6da] hover:bg-[#2a261f]"
      >
        <Icon size={12} />
        <span>{current.label}</span>
        <ChevronDown size={11} className="text-[#938a7c]" />
      </button>

      {open && (
        <div
          className={cn(
            'absolute left-0 w-44 z-50 bg-[#15130f] border border-[#2d2921] rounded-lg shadow-xl py-1',
            placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
          )}
        >
          {MODES.map((m) => {
            const MIcon = m.icon
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  if (askOnly && m.id !== 'ask') return
                  onChange(m.id)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#ece6da] hover:bg-[#2a261f] ${askOnly && m.id !== 'ask' ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <MIcon size={12} />
                <span className="flex-1 text-left">{m.label}</span>
                {m.id === 'agent' && <span className="text-[10px] text-[#6f675a]">Ctrl+I</span>}
                {m.id === value && <Check size={12} className="text-[#f0a93b]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}