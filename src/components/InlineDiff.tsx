import { useEffect, useMemo, useRef } from 'react'
import { useReviewIndex } from '../lib/review/hunkActions'

type Row = { kind: 'same' | 'add' | 'del'; text: string; newNo: number | null }

// Files longer than this are shown as "all removed, all added" to keep the work small
const MAX_LINES = 1500

// Line-by-line diff using a longest-common-subsequence table.
// Removed lines come before added lines when they replace each other.
export function diffRows(original: string, modified: string): Row[] {
  const a = original.split('\n')
  const b = modified.split('\n')

  if (a.length > MAX_LINES || b.length > MAX_LINES) {
    return [
      ...a.map((text) => ({ kind: 'del' as const, text, newNo: null })),
      ...b.map((text, i) => ({ kind: 'add' as const, text, newNo: i + 1 })),
    ]
  }

  const n = a.length
  const m = b.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const rows: Row[] = []
  let i = 0
  let j = 0
  let newNo = 1
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      rows.push({ kind: 'same', text: a[i], newNo: newNo++ })
      i++
      j++
    } else if (i < n && (j >= m || lcs[i + 1][j] >= lcs[i][j + 1])) {
      rows.push({ kind: 'del', text: a[i], newNo: null })
      i++
    } else {
      rows.push({ kind: 'add', text: b[j], newNo: newNo++ })
      j++
    }
  }
  return rows
}

// Adds the change number to each row, and marks the first row of each change
function groupRows(rows: Row[]) {
  let hunk = -1
  let inChange = false
  return rows.map((r) => {
    if (r.kind === 'same') {
      inChange = false
      return { ...r, hunk: -1, first: false }
    }
    const first = !inChange
    if (first) hunk++
    inChange = true
    return { ...r, hunk, first }
  })
}

// One view of the proposed change: removed lines in red, added lines in green.
// The change being reviewed is marked on the left and scrolled into view.
export function InlineDiff({ original, modified, path }: { original: string; modified: string; path: string }) {
  const rows = useMemo(() => groupRows(diffRows(original, modified)), [original, modified])
  const current = useReviewIndex((s) => (s.path === path ? s.index : 0))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-change="${current}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [current, rows])

  return (
    <div
      ref={ref}
      className="h-full overflow-auto bg-[#1a1814] text-[13px] leading-5"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}
    >
      <div className="min-w-max py-1">
        {rows.map((r, idx) => (
          <div
            key={idx}
            data-change={r.first ? r.hunk : undefined}
            className={[
              r.kind === 'add' ? 'bg-[#1b3a24]' : r.kind === 'del' ? 'bg-[#4a1d24]' : '',
              r.hunk === current ? 'shadow-[inset_3px_0_0_#f0a93b]' : '',
            ].join(' ')}
          >
            <div className="flex">
              <span className="w-12 shrink-0 pr-3 text-right select-none text-[#6f675a]">
                {r.kind === 'del' ? '' : r.newNo}
              </span>
              <span className="w-4 shrink-0 select-none text-[#938a7c]">
                {r.kind === 'add' ? '+' : r.kind === 'del' ? '-' : ' '}
              </span>
              <span className="whitespace-pre pr-8 text-[#ece6da]">{r.text || ' '}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
