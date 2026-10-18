import { create } from 'zustand'
import { useAppStore } from '../../store/useAppStore'
import { storageFor } from '../storage/active'
import { languageFor } from '../languages'

// A request to open a file and move the cursor to a line
export interface RevealRequest {
  path: string
  line: number
  column: number
  nonce: number
}

export const useReveal = create<{ request: RevealRequest | null }>()(() => ({ request: null }))

// The editor, once it has loaded. Set by CodeEditor.
interface RevealableEditor {
  setPosition: (p: { lineNumber: number; column: number }) => void
  revealLineInCenter: (line: number) => void
  focus: () => void
}
let editor: RevealableEditor | null = null
export function setRevealEditor(e: RevealableEditor): void {
  editor = e
}

// Moves the cursor when a reveal is requested, after the file's tab has been shown
useReveal.subscribe((state) => {
  const r = state.request
  if (!r) return
  window.setTimeout(() => {
    editor?.setPosition({ lineNumber: r.line, column: r.column })
    editor?.revealLineInCenter(r.line)
    editor?.focus()
  }, 50)
})

// Opens a file (or switches to its tab), then moves the cursor to a line
export async function openAndReveal(path: string, line: number, column: number): Promise<void> {
  const state = useAppStore.getState()
  if (state.openTabs.some((t) => t.path === path)) {
    state.setActiveTab(path)
  } else {
    if (!state.projectId) throw new Error('Open a project first.')
    const name = path.split('/').pop() ?? path
    const text = await storageFor(state.projectId).readFile(path)
    state.openFile(path, name, text, languageFor(name))
  }
  useReveal.setState({ request: { path, line, column, nonce: Date.now() } })
}