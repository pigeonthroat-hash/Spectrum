import { useAppStore } from '../../store/useAppStore'
import { createAndRefresh } from './tools'
import { decide, isCreatePending, forgetCreate } from './decisions'

// Apply button: writes a new file, or applies a proposed edit, then tells the waiting tool call
export async function applyPending(path: string): Promise<void> {
  const store = useAppStore.getState()
  const diff = store.pendingDiffs.find((d) => d.path === path)

  if (isCreatePending(path) && diff) {
    if (!store.projectId) return
    try {
      await createAndRefresh(store.projectId, path, diff.modified)
    } catch (err) {
      console.error(err)
      declinePending(path)
      return
    }
    forgetCreate(path)
    useAppStore.setState((s) => ({
      pendingDiffs: s.pendingDiffs.filter((d) => d.path !== path),
      openTabs: s.openTabs.map((t) => (t.path === path ? { ...t, isDirty: false } : t)),
    }))
  } else {
    store.acceptDiff(path)
  }
  decide(path, 'applied')
}

// Decline button: drops the change (or the new file's tab), then tells the waiting tool call
export function declinePending(path: string): void {
  const store = useAppStore.getState()
  if (isCreatePending(path)) {
    forgetCreate(path)
    store.setPendingDiffs(store.pendingDiffs.filter((d) => d.path !== path))
    store.closeTab(path)
  } else {
    store.rejectDiff(path)
  }
  decide(path, 'declined')
}