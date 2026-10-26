import { create } from 'zustand'

// Whether the explorer is open over the menu. Kept here, not in the menu, so it survives
// switching screens on a phone (the menu is unmounted when you go to the chat or editor).
export const useExplorerView = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))