import { create } from 'zustand'
import { useAppStore } from '../../store/useAppStore'
import { decide } from '../agent/decisions'
import { diffHunks, replaceLines } from './hunks'

// Which change the review bar is on, for each file
export const useReviewIndex = create<{ path: string | null; index: number; setIndex: (path: string, index: number) => void }>()(
  (set) => ({
    path: null,
    index: 0,
    setIndex: (path, index) => set({ path, index }),
  })
)

// Writes the new state of a pending change. When no changes are left, the change is finished
// and the waiting agent is told the outcome.
function settle(path: string, original: string, modified: string, tabContent: string | null, outcome: 'applied' | 'declined') {
  const st = useAppStore.getState()
  const finished = original === modified
  const pendingDiffs = finished
    ? st.pendingDiffs.filter((d) => d.path !== path)
    : st.pendingDiffs.map((d) => (d.path === path ? { ...d, original, modified } : d))
  const openTabs =
    tabContent === null
      ? st.openTabs
      : st.openTabs.map((t) => (t.path === path ? { ...t, content: tabContent, isDirty: true } : t))
  useAppStore.setState({ pendingDiffs, openTabs })
  if (finished) decide(path, outcome)
}

// Keeps one change: its proposed lines go into the file
export function acceptHunk(path: string, index: number): void {
  const d = useAppStore.getState().pendingDiffs.find((x) => x.path === path)
  if (!d) return
  const h = diffHunks(d.original, d.modified)[index]
  if (!h) return
  const next = replaceLines(d.original, h.aStart, h.aEnd, d.modified.split('\n').slice(h.bStart, h.bEnd))
  settle(path, next, d.modified, next, 'applied')
}

// Drops one change: the file keeps its current lines there
export function rejectHunk(path: string, index: number): void {
  const d = useAppStore.getState().pendingDiffs.find((x) => x.path === path)
  if (!d) return
  const h = diffHunks(d.original, d.modified)[index]
  if (!h) return
  const next = replaceLines(d.modified, h.bStart, h.bEnd, d.original.split('\n').slice(h.aStart, h.aEnd))
  settle(path, d.original, next, null, 'declined')
}