import { useEffect, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { diffHunks } from '../lib/review/hunks'
import { acceptHunk, rejectHunk, useReviewIndex } from '../lib/review/hunkActions'

// The bar at the bottom centre of a file under review. Shows the current change and moves between changes.
export function ReviewBar({ path }: { path: string }) {
  const diff = useAppStore((s) => s.pendingDiffs.find((d) => d.path === path))
  const stored = useReviewIndex((s) => (s.path === path ? s.index : 0))
  const setIndex = useReviewIndex((s) => s.setIndex)

  const original = diff?.original ?? ''
  const modified = diff?.modified ?? ''
  const count = useMemo(() => diffHunks(original, modified).length, [original, modified])
  const index = Math.min(stored, Math.max(0, count - 1))

  const go = (i: number) => {
    if (count === 0) return
    setIndex(path, (i + count) % count)
  }
  const accept = () => acceptHunk(path, index)
  const reject = () => rejectHunk(path, index)

  // Keyboard: Ctrl+Enter accepts, Ctrl+Backspace rejects, Alt+Up and Alt+Down move between changes.
  // Ignored while typing in the chat or another text box.
  useEffect(() => {
    if (count === 0) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault()
        acceptHunk(path, index)
      } else if (e.key === 'Backspace' && e.ctrlKey) {
        e.preventDefault()
        rejectHunk(path, index)
      } else if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault()
        setIndex(path, (index + 1) % count)
      } else if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault()
        setIndex(path, (index - 1 + count) % count)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count, index, path, setIndex])

  if (count === 0) return null

  return (
    <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-md border border-[#2d2921] bg-[#15130f] px-2 py-1 text-xs shadow-xl">
      <span className="px-1 tabular-nums text-[#938a7c]">
        {index + 1}/{count}
      </span>
      <button
        type="button"
        title="Previous change (Alt+Up)"
        onClick={() => go(index - 1)}
        className="p-1 rounded text-[#938a7c] hover:text-white hover:bg-[#2a261f]"
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        title="Next change (Alt+Down)"
        onClick={() => go(index + 1)}
        className="p-1 rounded text-[#938a7c] hover:text-white hover:bg-[#2a261f]"
      >
        <ChevronDown size={14} />
      </button>
      <button
        type="button"
        title="Reject this change (Ctrl+Backspace)"
        onClick={reject}
        className="px-2 py-1 rounded text-[#ece6da] hover:bg-[#2a261f]"
      >
        Reject
      </button>
      <button
        type="button"
        title="Accept this change (Ctrl+Enter)"
        onClick={accept}
        className="px-2 py-1 rounded bg-[#f0a93b] hover:bg-[#f5b952] text-[#1a1407]"
      >
        Accept
      </button>
    </div>
  )
}
