import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ChatStyle = 'classic' | 'liquid'
export type AgentMode = 'agent' | 'plan' | 'debug' | 'ask'

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
  mode: AgentMode
  pendingDiffs: DiffHunk[]

  // UI
  sidebarWidth: number
  explorerWidth: number
  showExplorer: boolean
  showAI: boolean
  chatStyle: ChatStyle

  // Actions
  setRootPath: (path: string) => void
  setFileTree: (tree: FileNode[]) => void
  openFile: (path: string, name: string, content: string, language?: string) => void
  closeTab: (path: string) => void
  setActiveTab: (path: string) => void
  updateTabContent: (path: string, content: string) => void
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, update: (prev: string) => string) => void
  clearMessages: () => void
  setGenerating: (v: boolean) => void
  setModel: (model: string) => void
  setMode: (mode: AgentMode) => void
  setPendingDiffs: (diffs: DiffHunk[]) => void
  acceptDiff: (path: string) => void
  rejectDiff: (path: string) => void
  acceptAllDiffs: () => void
  rejectAllDiffs: () => void
  setSidebarWidth: (w: number) => void
  setExplorerWidth: (w: number) => void
  toggleExplorer: () => void
  toggleAI: () => void
  setChatStyle: (style: ChatStyle) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      rootPath: null,
      fileTree: [],
      openTabs: [],
      activeTabPath: null,

      messages: [],
      isGenerating: false,
      selectedModel: 'ollama/gemma4:e4b',
      mode: 'agent',
      pendingDiffs: [],

      sidebarWidth: 380,
      explorerWidth: 260,
      showExplorer: true,
      showAI: true,
      chatStyle: 'classic',

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

      addMessage: (msg) => {
        const id = crypto.randomUUID()
        set({
          messages: [...get().messages, { ...msg, id, timestamp: Date.now() }],
        })
        return id
      },

      updateMessage: (id, update) =>
        set({
          messages: get().messages.map((m) =>
            m.id === id ? { ...m, content: update(m.content) } : m
          ),
        }),

      clearMessages: () => set({ messages: [] }),

      setGenerating: (v) => set({ isGenerating: v }),
      setModel: (model) => set({ selectedModel: model }),
      setMode: (mode) => set({ mode }),
      setPendingDiffs: (diffs) => set({ pendingDiffs: diffs }),

      acceptDiff: (path) => {
        const { pendingDiffs, openTabs } = get()
        const diff = pendingDiffs.find((d) => d.path === path)
        if (!diff) return
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
      setChatStyle: (style) => set({ chatStyle: style }),
    }),
    {
      name: 'spectrum-settings',
      // Only these survive a reload
      partialize: (s) => ({ chatStyle: s.chatStyle, selectedModel: s.selectedModel }),
    }
  )
)
