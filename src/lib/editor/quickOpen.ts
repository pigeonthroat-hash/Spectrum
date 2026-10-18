import { create } from 'zustand'

// Whether the Quick Open (Ctrl+P) box is showing
export const useQuickOpen = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))