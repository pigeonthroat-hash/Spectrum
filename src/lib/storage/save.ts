import { useAppStore } from '../../store/useAppStore'
import { storageFor } from './active'

// Saves one open tab to the current cloud project
export async function saveTab(path: string): Promise<void> {
  const { projectId, openTabs, markSaved, setSaveStatus } = useAppStore.getState()
  const tab = openTabs.find((t) => t.path === path)
  if (!projectId || !tab || !tab.isDirty) return

  const snapshot = tab.content
  setSaveStatus('saving')
  try {
    await storageFor(projectId).writeFile(path, snapshot)
    markSaved(path, snapshot)
    setSaveStatus('saved')
  } catch (err) {
    console.error('Save failed', err)
    setSaveStatus('error')
  }
}