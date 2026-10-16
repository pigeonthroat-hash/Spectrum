import { File } from 'lucide-react'
import { cn } from '../lib/utils'

// Popup above the chat input that lists project files when you type "@"
export function MentionMenu({
  paths,
  highlight,
  onPick,
  onHover,
}: {
  paths: string[]
  highlight: number
  onPick: (path: string) => void
  onHover: (index: number) => void
}) {
  return (
    <div className="absolute bottom-full left-2 right-2 mb-2 z-20 rounded-md border border-[#30363d] bg-[#161b22] shadow-xl overflow-hidden">
      <div className="px-3 py-1.5 text-[11px] text-[#8b949e] border-b border-[#30363d]">Files</div>
      {paths.length === 0 ? (
        <div className="px-3 py-2 text-xs text-[#8b949e]">No matching files</div>
      ) : (
        <ul className="max-h-60 overflow-y-auto py-1">
          {paths.map((p, i) => {
            const slash = p.lastIndexOf('/')
            const name = slash >= 0 ? p.slice(slash + 1) : p
            const dir = slash >= 0 ? p.slice(0, slash) : ''
            return (
              <li key={p}>
                <button
                  type="button"
                  // mousedown keeps the text box focused
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onPick(p)
                  }}
                  onMouseEnter={() => onHover(i)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs',
                    i === highlight ? 'bg-[#21262d] text-[#e6edf3]' : 'text-[#c9d1d9]'
                  )}
                >
                  <File size={12} className="shrink-0 text-[#8b949e]" />
                  <span className="truncate">{name}</span>
                  {dir && <span className="ml-auto truncate text-[11px] text-[#8b949e]">{dir}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}