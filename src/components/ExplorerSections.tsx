import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../lib/utils'

// Collapsible sections under the file tree. Both are placeholders until their features exist.
const SECTIONS = [
  { title: 'Outline', empty: 'No symbols to show' },
  { title: 'Timeline', empty: 'No local history yet' },
]

export function ExplorerSections() {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  return (
    <div className="border-t border-[#2d2921] shrink-0">
      {SECTIONS.map((s) => {
        const isOpen = !!open[s.title]
        return (
          <div key={s.title}>
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [s.title]: !o[s.title] }))}
              className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#938a7c] hover:text-[#f0a93b]"
            >
              <ChevronDown size={12} className={cn('transition-transform', !isOpen && '-rotate-90')} />
              {s.title}
            </button>
            {isOpen && <p className="px-6 pb-2 text-[11px] text-[#6f675a]">{s.empty}</p>}
          </div>
        )
      })}
    </div>
  )
}