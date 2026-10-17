import { useMemo } from 'react'

type Row = { kind: 'same' | 'add' | 'del'; text: string; oldNo: number | null; newNo: number | null }

// Files longer than this are shown as "all removed, all added" to keep the work small
const MAX_LINES = 1500

// Line-by-line diff using a longest-common-subsequence table.
// Removed lines come before added lines when they replace each other.
export function diffRows(original: string, modified: string): Row[] {
  const a = original.split('\n')
  const b = modified.split('\n')

  if (a.length > MAX_LINES || b.length > MAX_LINES) {
    return [
      ...a.map((text) => ({ kind: 'del' as const, text, oldNo: null, newNo: null })),
      ...b.map((text, i) => ({ kind: 'add' as const, text, oldNo: null, newNo: i + 1 })),
    ]
  }

  const n = a.length
  const m = b.length
  // lcs[i][j] = length of the common part of a[i..] and b[j..]
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
      rows.push({ kind: 'same', text: a[i], oldNo: null, newNo: newNo++ })
      i++
      j++
    } else if (i < n && (j >= m || lcs[i + 1][j] >= lcs[i][j + 1])) {
      // Removed lines are written first, so the green lines sit below the red ones
      rows.push({ kind: 'del', text: a[i], oldNo: null, newNo: null })
      i++
    } else {
      rows.push({ kind: 'add', text: b[j], oldNo: null, newNo: newNo++ })
      j++
    }
  }
  return rows
}

// One view of the proposed change: removed lines in red (no number), added lines in green (new line number)
export function InlineDiff({ original, modified }: { original: string; modified: string }) {
  const rows = useMemo(() => diffRows(original, modified), [original, modified])
  return (
    <div
      className="h-full overflow-auto bg-[#0d1117] text-[13px] leading-5"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}
    >
      <div className="min-w-max py-1">
        {rows.map((r, idx) => (
          <div
            key={idx}
            className={r.kind === 'add' ? 'bg-[#1b3a24]' : r.kind === 'del' ? 'bg-[#4a1d24]' : ''}
          >
            <div className="flex">
              <span className="w-12 shrink-0 pr-3 text-right select-none text-[#6e7681]">
                {r.kind === 'del' ? '' : r.newNo}
              </span>
              <span className="w-4 shrink-0 select-none text-[#8b949e]">
                {r.kind === 'add' ? '+' : r.kind === 'del' ? '-' : ' '}
              </span>
              <span className="whitespace-pre pr-8 text-[#e6edf3]">{r.text || ' '}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}