import { create } from 'zustand'
import type { PanelId } from '../store/useAppStore'

// Shared state for pointer-based dragging (files and panels)

export type DragItem =
  | { kind: 'file'; path: string; name: string; isFolder: boolean }
  | { kind: 'panel'; id: PanelId; label: string }

export interface FileTarget {
  folder: string // where the item will go ('' = top level)
  row: string | null // row to highlight (null = empty space)
  edge: 'top' | 'bottom' | 'inside' | null
}

interface DragStore {
  item: DragItem | null
  x: number
  y: number
  fileTarget: FileTarget | null
  dockSide: 'left' | 'right' | null
  start: (item: DragItem, x: number, y: number) => void
  setPointer: (x: number, y: number) => void
  setFileTarget: (target: FileTarget | null) => void
  setDockSide: (side: 'left' | 'right' | null) => void
  clear: () => void
}

function sameTarget(a: FileTarget | null, b: FileTarget | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.folder === b.folder && a.row === b.row && a.edge === b.edge
}

export const useDragStore = create<DragStore>()((set, get) => ({
  item: null,
  x: 0,
  y: 0,
  fileTarget: null,
  dockSide: null,
  start: (item, x, y) => set({ item, x, y, fileTarget: null, dockSide: null }),
  setPointer: (x, y) => set({ x, y }),
  setFileTarget: (target) => {
    if (!sameTarget(get().fileTarget, target)) set({ fileTarget: target })
  },
  setDockSide: (side) => {
    if (get().dockSide !== side) set({ dockSide: side })
  },
  clear: () => set({ item: null, fileTarget: null, dockSide: null }),
}))