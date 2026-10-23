// A changed block: lines [aStart, aEnd) of the original, replaced by lines [bStart, bEnd) of the proposal
export interface Hunk {
  aStart: number
  aEnd: number
  bStart: number
  bEnd: number
}

// Bigger than this and the whole file counts as one change, to keep the work small
const MAX_CELLS = 2_000_000

export function diffHunks(original: string, modified: string): Hunk[] {
  if (original === modified) return []
  const a = original.split('\n')
  const b = modified.split('\n')

  // Lines that match at the start and end are skipped first
  let pre = 0
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++
  let suf = 0
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++
  const aEnd = a.length - suf
  const bEnd = b.length - suf
  const n = aEnd - pre
  const m = bEnd - pre

  if (n * m > MAX_CELLS) return [{ aStart: pre, aEnd, bStart: pre, bEnd }]

  // lcs[i][j] = length of the common part of the middle of a from i, and of b from j
  const W = m + 1
  const lcs = new Uint32Array((n + 1) * (m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * W + j] =
        a[pre + i] === b[pre + j] ? lcs[(i + 1) * W + j + 1] + 1 : Math.max(lcs[(i + 1) * W + j], lcs[i * W + j + 1])
    }
  }

  // Walk both versions; each run of lines between matching lines is one change
  const hunks: Hunk[] = []
  let i = 0
  let j = 0
  let gapA = 0
  let gapB = 0
  const close = (ei: number, ej: number) => {
    if (ei > gapA || ej > gapB) hunks.push({ aStart: pre + gapA, aEnd: pre + ei, bStart: pre + gapB, bEnd: pre + ej })
  }
  while (i < n || j < m) {
    if (i < n && j < m && a[pre + i] === b[pre + j]) {
      close(i, j)
      i++
      j++
      gapA = i
      gapB = j
    } else if (i < n && (j >= m || lcs[(i + 1) * W + j] >= lcs[i * W + j + 1])) {
      i++
    } else {
      j++
    }
  }
  close(n, m)
  return hunks
}

// Replaces lines [start, end) of a text with the given lines
export function replaceLines(text: string, start: number, end: number, lines: string[]): string {
  const t = text.split('\n')
  return [...t.slice(0, start), ...lines, ...t.slice(end)].join('\n')
}