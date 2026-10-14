import { create } from 'zustand'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
  content?: string
}

export interface OpenTab {
  path: string
  name: string
  content: string
  language: string
  isDirty: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface DiffHunk {
  path: string
  original: string
  modified: string
  accepted?: boolean
}

interface AppState {
  // Workspace
  rootPath: string | null
  fileTree: FileNode[]
  openTabs: OpenTab[]
  activeTabPath: string | null

  // AI
  messages: ChatMessage[]
  isGenerating: boolean
  selectedModel: string
  mode: 'chat' | 'agent' | 'composer'
  pendingDiffs: DiffHunk[]

  // UI
  sidebarWidth: number
  explorerWidth: number
  showExplorer: boolean
  showAI: boolean

  // Actions
  setRootPath: (path: string) => void
  setFileTree: (tree: FileNode[]) => void
  openFile: (path: string, name: string, content: string, language?: string) => void
  closeTab: (path: string) => void
  setActiveTab: (path: string) => void
  updateTabContent: (path: string, content: string) => void
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  setGenerating: (v: boolean) => void
  setModel: (model: string) => void
  setMode: (mode: 'chat' | 'agent' | 'composer') => void
  setPendingDiffs: (diffs: DiffHunk[]) => void
  acceptDiff: (path: string) => void
  rejectDiff: (path: string) => void
  acceptAllDiffs: () => void
  rejectAllDiffs: () => void
  setSidebarWidth: (w: number) => void
  setExplorerWidth: (w: number) => void
  toggleExplorer: () => void
  toggleAI: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  rootPath: null,
  fileTree: [],
  openTabs: [],
  activeTabPath: null,

  messages: [],
  isGenerating: false,
  selectedModel: 'ollama/gemma2:9b',
  mode: 'agent',
  pendingDiffs: [],

  sidebarWidth: 380,
  explorerWidth: 260,
  showExplorer: true,
  showAI: true,

  setRootPath: (path) => set({ rootPath: path }),
  setFileTree: (tree) => set({ fileTree: tree }),

  openFile: (path, name, content, language = 'typescript') => {
    const { openTabs } = get()
    const exists = openTabs.find((t) => t.path === path)
    if (exists) {
      set({ activeTabPath: path })
      return
    }
    set({
      openTabs: [...openTabs, { path, name, content, language, isDirty: false }],
      activeTabPath: path,
    })
  },

  closeTab: (path) => {
    const { openTabs, activeTabPath } = get()
    const next = openTabs.filter((t) => t.path !== path)
    let nextActive = activeTabPath
    if (activeTabPath === path) {
      nextActive = next.length ? next[next.length - 1].path : null
    }
    set({ openTabs: next, activeTabPath: nextActive })
  },

  setActiveTab: (path) => set({ activeTabPath: path }),

  updateTabContent: (path, content) => {
    set({
      openTabs: get().openTabs.map((t) =>
        t.path === path ? { ...t, content, isDirty: true } : t
      ),
    })
  },

  addMessage: (msg) =>
    set({
      messages: [
        ...get().messages,
        { ...msg, id: crypto.randomUUID(), timestamp: Date.now() },
      ],
    }),

  setGenerating: (v) => set({ isGenerating: v }),
  setModel: (model) => set({ selectedModel: model }),
  setMode: (mode) => set({ mode }),
  setPendingDiffs: (diffs) => set({ pendingDiffs: diffs }),

  acceptDiff: (path) => {
    const { pendingDiffs, openTabs } = get()
    const diff = pendingDiffs.find((d) => d.path === path)
    if (!diff) return
    // Apply to open tab if present
    const updatedTabs = openTabs.map((t) =>
      t.path === path ? { ...t, content: diff.modified, isDirty: true } : t
    )
    set({
      openTabs: updatedTabs,
      pendingDiffs: pendingDiffs.filter((d) => d.path !== path),
    })
  },

  rejectDiff: (path) =>
    set({ pendingDiffs: get().pendingDiffs.filter((d) => d.path !== path) }),

  acceptAllDiffs: () => {
    const { pendingDiffs, openTabs } = get()
    let tabs = [...openTabs]
    for (const diff of pendingDiffs) {
      tabs = tabs.map((t) =>
        t.path === diff.path ? { ...t, content: diff.modified, isDirty: true } : t
      )
    }
    set({ openTabs: tabs, pendingDiffs: [] })
  },

  rejectAllDiffs: () => set({ pendingDiffs: [] }),

  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setExplorerWidth: (w) => set({ explorerWidth: w }),
  toggleExplorer: () => set({ showExplorer: !get().showExplorer }),
  toggleAI: () => set({ showAI: !get().showAI }),
}))
