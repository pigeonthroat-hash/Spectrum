import { useEffect, useMemo, useState } from 'react'
import { File } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { listPaths } from '../lib/agent/tools'
import { openAndReveal } from '../lib/editor/reveal'
import { useQuickOpen } from '../lib/editor/quickOpen'
import { notify } from '../lib/notify/store'
import { errorText } from '../lib/errors'

// Ctrl+P: type part of a file name, then press Enter to open it
export function QuickOpen() {
  const open = useQuickOpen((s) => s.open)
  const projectId = useAppStore((s) => s.projectId)
  const [paths, setPaths] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setIndex(0)
    if (projectId) listPaths(projectId).then(setPaths).catch(() => setPaths([]))
  }, [open, projectId])

  const matches = useMemo(() => {
    const q = query.toLowerCase()
    return paths.filter((p) => p.toLowerCase().includes(q)).slice(0, 50)
  }, [paths, query])

  if (!open) return null

  const close = () => useQuickOpen.getState().setOpen(false)
  const pick = async (path: string) => {
    close()
    try {
      await openAndReveal(path, 1, 1)
    } catch (err) {
      notify('Could not open ' + path + ': ' + errorText(err))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/40" onMouseDown={close}>
      <div
        className="anim-pop w-[560px] max-w-[92vw] rounded-lg border border-[#30363d] bg-[#161b22] shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
            else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(i + 1, matches.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter' && matches[index]) void pick(matches[index])
          }}
          placeholder={projectId ? 'Search files by name' : 'Open a project first'}
          className="w-full px-3 py-2 bg-transparent border-b border-[#30363d] text-sm text-[#e6edf3] outline-none placeholder:text-[#6e7681]"
        />
        <ul className="max-h-80 overflow-y-auto py-1">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[#8b949e]">No matching files</li>
          ) : (
            matches.map((p, i) => {
              const slash = p.lastIndexOf('/')
              const name = slash >= 0 ? p.slice(slash + 1) : p
              const dir = slash >= 0 ? p.slice(0, slash) : ''
              return (
                <li key={p}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndex(i)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      void pick(p)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs ${i === index ? 'bg-[#21262d] text-[#e6e6e6]' : 'text-[#c9d1d9]'}`}
                  >
                    <File size={12} className="shrink-0 text-[#8b949e]" />
                    <span>{name}</span>
                    {dir && <span className="ml-auto truncate text-[#6e7681]">{dir}</span>}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}