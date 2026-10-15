import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { saveTab } from '../lib/storage/save'

const AUTOSAVE_DELAY_MS = 2000

// Invisible: autosaves edited tabs after a short pause, and handles Ctrl+S / Cmd+S
export function SaveController() {
  const openTabs = useAppStore((s) => s.openTabs)
  const timers = useRef(new Map<string, number>())

  // Restart the autosave timer for every edited tab whenever tabs change
  useEffect(() => {
    const pending = timers.current
    for (const tab of openTabs) {
      const existing = pending.get(tab.path)
      if (existing !== undefined) window.clearTimeout(existing)
      pending.delete(tab.path)
      if (tab.isDirty) {
        pending.set(
          tab.path,
          window.setTimeout(() => {
            pending.delete(tab.path)
            void saveTab(tab.path)
          }, AUTOSAVE_DELAY_MS)
        )
      }
    }
  }, [openTabs])

  // Clear timers on unmount
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((id) => window.clearTimeout(id))
      pending.clear()
    }
  }, [])

  // Ctrl+S / Cmd+S saves the active tab right away
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        const path = useAppStore.getState().activeTabPath
        if (!path) return
        const existing = timers.current.get(path)
        if (existing !== undefined) window.clearTimeout(existing)
        timers.current.delete(path)
        void saveTab(path)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return null
}