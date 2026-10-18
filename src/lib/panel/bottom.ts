import { create } from 'zustand'

export type BottomTab = 'problems' | 'output' | 'debug' | 'terminal' | 'ports'

// The bottom panel: open or closed, and which tab is showing
interface BottomState {
  open: boolean
  tab: BottomTab
  toggle: () => void
  close: () => void
  show: (tab: BottomTab) => void
}

export const useBottomPanel = create<BottomState>()((set, get) => ({
  open: false,
  tab: 'problems',
  toggle: () => set({ open: !get().open }),
  close: () => set({ open: false }),
  show: (tab) => set({ open: true, tab }),
}))