import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getForever, setForever, type AutoApplyScope } from '../lib/agent/autoApply'

const OPTIONS: { label: string; scope: AutoApplyScope }[] = [
  { label: 'Apply Automatically in this Message', scope: 'message' },
  { label: 'Apply Automatically in this Session', scope: 'session' },
  { label: 'Apply Automatically Forever', scope: 'forever' },
]

// Dropdown for the Apply Automatically button
export function AutoApplyMenu({ onChoose }: { onChoose: (scope: AutoApplyScope) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const forever = getForever()

  // Close the menu when clicking anywhere else
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] rounded border border-[#30363d]"
      >
        Apply Automatically <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-72 rounded-md border border-[#30363d] bg-[#161b22] shadow-xl py-1">
          {OPTIONS.map((o) => (
            <button
              key={o.scope}
              type="button"
              onClick={() => {
                setOpen(false)
                onChoose(o.scope)
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-[#e6edf3] hover:bg-[#21262d]"
            >
              {o.label}
            </button>
          ))}
          {forever && (
            <button
              type="button"
              onClick={() => {
                setForever(false)
                setOpen(false)
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-[#8b949e] hover:bg-[#21262d] border-t border-[#30363d]"
            >
              Turn off Apply Automatically Forever
            </button>
          )}
        </div>
      )}
    </div>
  )
}