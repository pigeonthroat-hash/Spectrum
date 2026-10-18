import { create } from 'zustand'

// Toasts in the bottom right. Ones with buttons stay until you act or close them.
export interface Toast {
  id: number
  message: string
  actions?: { label: string; run: () => void }[]
}

let nextId = 1

interface ToastState {
  toasts: Toast[]
  push: (message: string, actions?: Toast['actions']) => void
  dismiss: (id: number) => void
}

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (message, actions) => {
    const id = nextId++
    set({ toasts: [...get().toasts, { id, message, actions }] })
    if (!actions || actions.length === 0) window.setTimeout(() => get().dismiss(id), 8000)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

export function notify(message: string, actions?: Toast['actions']): void {
  useToasts.getState().push(message, actions)
}