import { useAppStore, type ChatMessage } from '../../store/useAppStore'
import type { Block } from '../agent/types'
import { diffRows } from '../../components/InlineDiff'

export interface ReviewRow {
  path: string
  added: number
  removed: number
}

export function changeCounts(original: string, modified: string): { added: number; removed: number } {
  const rows = diffRows(original, modified)
  return {
    added: rows.filter((r) => r.kind === 'add').length,
    removed: rows.filter((r) => r.kind === 'del').length,
  }
}

export function findLastAssistant(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant') return i
  return -1
}

// Records the files that the reply proposed changes to, so the reply can show a review card.
// A file that an earlier reply already reported is not repeated.
export function attachReviewToLastReply(): void {
  const { pendingDiffs, messages } = useAppStore.getState()
  const reported = new Set(messages.flatMap((m) => (m.review ?? []).map((r) => r.path)))
  const rows: ReviewRow[] = pendingDiffs
    .filter((d) => !reported.has(d.path))
    .map((d) => ({ path: d.path, ...changeCounts(d.original, d.modified) }))
  if (rows.length === 0) return
  useAppStore.setState((s) => {
    const idx = findLastAssistant(s.messages)
    if (idx < 0) return {}
    return { messages: s.messages.map((m, i) => (i === idx ? { ...m, review: [...(m.review ?? []), ...rows] } : m)) }
  })
}

// The files a reply read with read_file, in the order they were read
export function usedFiles(blocks: Block[]): string[] {
  const out: string[] = []
  for (const b of blocks) {
    if (b.type !== 'tool' || b.name !== 'read_file') continue
    try {
      const p = JSON.parse(b.input).path
      if (typeof p === 'string' && p && !out.includes(p)) out.push(p)
    } catch {
      // the input was not JSON: nothing to add
    }
  }
  return out
}