import { useAppStore } from '../../store/useAppStore'

// Removes a deleted file (or folder) from the editor: its tabs, its pending changes,
// and the active tab if it was one of them. Otherwise autosave can write the file back.
export function forgetPath(path: string): void {
  const state = useAppStore.getState()
  const gone = (p: string) => p === path || p.startsWith(path + '/')
  const remaining = state.openTabs.filter((t) => !gone(t.path))
  const activeGone = state.activeTabPath !== null && gone(state.activeTabPath)
  useAppStore.setState({
    openTabs: remaining,
    activeTabPath: activeGone ? (remaining[remaining.length - 1]?.path ?? null) : state.activeTabPath,
    pendingDiffs: state.pendingDiffs.filter((d) => !gone(d.path)),
  })
}