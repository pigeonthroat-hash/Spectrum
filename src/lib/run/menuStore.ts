import { create } from 'zustand'

// Position and folder of the right-click menu in the file explorer
interface FolderMenuState {
  menu: { x: number; y: number; path: string } | null
  open: (x: number, y: number, path: string) => void
  close: () => void
}

export const useFolderMenu = create<FolderMenuState>()((set) => ({
  menu: null,
  open: (x, y, path) => set({ menu: { x, y, path } }),
  close: () => set({ menu: null }),
}))