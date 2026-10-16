import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ChatStyle = 'classic' | 'liquid'
export type AgentMode = 'agent' | 'plan' | 'debug' | 'ask'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
export type PanelId = 'explorer' | 'chat'
export type MobileView = 'explorer' | 'editor' | 'chat'

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
  openTabs: OpenTab[]
  activeTabPath: string | null
  fileTree: FileNode[]

  // AI
  messages: ChatMessage[]
  isGenerating: boolean
  selectedModel: string
  mode: AgentMode
  pendingDiffs: DiffHunk[]

  // Panels: sizes and visibility
  sidebarWidth: number
  explorerWidth: number
  showExplorer: boolean
  showAI: boolean
  chatStyle: ChatStyle

  // Panels: layout
  leftPanel: PanelId // which panel sits on the left
  rightPanel: PanelId // which panel sits on the right
  explorerCollapsed: boolean
  chatCollapsed: boolean
  maximized: PanelId | null
  draggingPanel: PanelId | null
  mobileView: MobileView

  // Cloud project
  projectId: string | null
  projectName: string | null
  saveStatus: SaveStatus

  // Actions: files and tabs
  setFileTree: (tree: FileNode[]) => void
  openFile: (path: string, name: string, content: string, language?: string) => void
  closeTab: (path: string) => void
  setActiveTab: (path: string) => void
  updateTabContent: (path: string, content: string) => void
  remapTabs: (from: string, to: string) => void

  // Actions: AI
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

  // Actions: panels
  setSidebarWidth: (w: number) => void
  setExplorerWidth: (w: number) => void
  toggleExplorer: () => void
  toggleAI: () => void
  hidePanel: (id: PanelId) => void
  setCollapsed: (id: PanelId, value: boolean) => void
  toggleMaximized: (id: PanelId) => void
  dockPanel: (id: PanelId, slot: 'left' | 'right') => void
  setDraggingPanel: (id: PanelId | null) => void
  setChatStyle: (style: ChatStyle) => void
  setMobileView: (view: MobileView) => void

  // Actions: cloud project
  setProject: (id: string | null, name: string | null) => void
  markSaved: (path: string, content: string) => void
  setSaveStatus: (status: SaveStatus) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      openTabs: [],
      activeTabPath: null,
      fileTree: [],

      messages: [],
      isGenerating: false,
      selectedModel: 'browser/Llama-3.2-3B-Instruct-q4f16_1-MLC',
      mode: 'agent',
      pendingDiffs: [],

      sidebarWidth: 380,
      explorerWidth: 260,
      showExplorer: true,
      showAI: true,
      chatStyle: 'classic',
      mobileView: 'editor',

      leftPanel: 'explorer',
      rightPanel: 'chat',
      explorerCollapsed: false,
      chatCollapsed: false,
      maximized: null,
      draggingPanel: null,

      projectId: null,
      projectName: null,
      saveStatus: 'idle',

      setFileTree: (tree) => set({ fileTree: tree }),

      openFile: (path, name, content, language = 'typescript') => {
        const { openTabs } = get()
        if (openTabs.some((t) => t.path === path)) {
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

      // After a file or folder moves, open tabs follow it to the new path
      remapTabs: (from, to) => {
        const remap = (p: string) =>
          p === from ? to : p.startsWith(`${from}/`) ? `${to}${p.slice(from.length)}` : p
        const active = get().activeTabPath
        set({
          openTabs: get().openTabs.map((t) => {
            const path = remap(t.path)
            return path === t.path ? t : { ...t, path, name: path.split('/').pop() ?? path }
          }),
          activeTabPath: active ? remap(active) : null,
        })
      },

      addMessage: (msg) => {
        const id = crypto.randomUUID()
        set({ messages: [...get().messages, { ...msg, id, timestamp: Date.now() }] })
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
        set({
          openTabs: openTabs.map((t) =>
            t.path === path ? { ...t, content: diff.modified, isDirty: true } : t
          ),
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

      toggleExplorer: () => {
        if (get().showExplorer) get().hidePanel('explorer')
        else set({ showExplorer: true })
      },

      toggleAI: () => {
        if (get().showAI) get().hidePanel('chat')
        else set({ showAI: true })
      },

      // Closing a panel hides it. The top bar brings it back.
      hidePanel: (id) =>
        set({
          ...(id === 'explorer' ? { showExplorer: false } : { showAI: false }),
          maximized: get().maximized === id ? null : get().maximized,
          draggingPanel: null,
        }),

      setCollapsed: (id, value) =>
        set(id === 'explorer' ? { explorerCollapsed: value } : { chatCollapsed: value }),

      toggleMaximized: (id) => set({ maximized: get().maximized === id ? null : id }),

      // Puts the dragged panel in the given slot. With two panels, that means swapping them.
      dockPanel: (id, slot) => {
        const current = slot === 'left' ? get().leftPanel : get().rightPanel
        if (current === id) {
          set({ draggingPanel: null })
          return
        }
        set({
          leftPanel: get().rightPanel,
          rightPanel: get().leftPanel,
          draggingPanel: null,
        })
      },

      setDraggingPanel: (id) => set({ draggingPanel: id }),

      setChatStyle: (style) => set({ chatStyle: style }),
      setMobileView: (view) => set({ mobileView: view }),

      // Switching projects clears open tabs and the tree
      setProject: (id, name) =>
        set({
          projectId: id,
          projectName: name,
          openTabs: [],
          activeTabPath: null,
          fileTree: [],
          pendingDiffs: [],
          saveStatus: 'idle',
        }),

      // Clears "unsaved" only if nothing was typed while the save was running
      markSaved: (path, content) =>
        set({
          openTabs: get().openTabs.map((t) =>
            t.path === path ? { ...t, isDirty: t.content !== content } : t
          ),
        }),

      setSaveStatus: (status) => set({ saveStatus: status }),
    }),
    {
      name: 'spectrum-settings',
      // Only these survive a reload
      partialize: (s) => ({
        chatStyle: s.chatStyle,
        selectedModel: s.selectedModel,
        sidebarWidth: s.sidebarWidth,
        explorerWidth: s.explorerWidth,
        showExplorer: s.showExplorer,
        showAI: s.showAI,
        leftPanel: s.leftPanel,
        rightPanel: s.rightPanel,
        explorerCollapsed: s.explorerCollapsed,
        chatCollapsed: s.chatCollapsed,
      }),
    }
  )
)