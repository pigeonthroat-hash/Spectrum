import { create } from 'zustand'
import { useAppStore, type PanelId } from '../store/useAppStore'

// How long the slide-away takes. The panel is removed when it ends.
export const CLOSE_MS = 220

// The panel that is sliding away right now (null when none)
export const useClosing = create<{ closing: PanelId | null }>()(() => ({ closing: null }))

export function requestClose(id: PanelId): void {
  if (useClosing.getState().closing) return
  useClosing.setState({ closing: id })
  window.setTimeout(() => {
    useAppStore.getState().hidePanel(id)
    useClosing.setState({ closing: null })
  }, CLOSE_MS)
}