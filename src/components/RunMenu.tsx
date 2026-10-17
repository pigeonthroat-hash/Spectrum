import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { answerRun, type RunChoice } from '../lib/agent/runApproval'

// The same look as the Apply Automatically button: a main button, plus a menu of automatic choices
const OPTIONS: { label: string; choice: RunChoice }[] = [
  { label: 'Run Automatically in this Message', choice: 'message' },
  { label: 'Run Automatically in this Session', choice: 'session' },
  { label: 'Run Automatically Forever', choice: 'forever' },
]

const BUTTON = 'flex items-center gap-1 px-2 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] border border-[#30363d]'

export function RunMenu({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
    <div ref={ref} className="relative flex items-center">
      <button type="button" onClick={() => answerRun(id, 'once')} className={`${BUTTON} rounded-l`}>
        Run
      </button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="More run options"
        className={`${BUTTON} rounded-r border-l-0 px-1.5`}
      >
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-72 rounded-md border border-[#30363d] bg-[#161b22] shadow-xl py-1">
          {OPTIONS.map((o) => (
            <button
              key={o.choice}
              type="button"
              onClick={() => {
                setOpen(false)
                answerRun(id, o.choice)
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-[#e6edf3] hover:bg-[#21262d]"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}