import { create } from 'zustand'

// Files picked with the @ menu. They show as chips and are sent with the next message.
interface AttachmentState {
  files: string[]
  add: (path: string) => void
  remove: (path: string) => void
  clear: () => void
}

export const useAttachments = create<AttachmentState>()((set, get) => ({
  files: [],
  add: (path) => {
    if (!get().files.includes(path)) set({ files: [...get().files, path] })
  },
  remove: (path) => set({ files: get().files.filter((f) => f !== path) }),
  clear: () => set({ files: [] }),
}))