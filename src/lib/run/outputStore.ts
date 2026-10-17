import { create } from 'zustand'

// The shell prompt shown in the Output panel, like a terminal
export const PROMPT = 'PS /project> '

// The Output panel's state. Not saved between reloads.
export type OutputLine = { kind: 'command' | 'log' | 'error' | 'info' | 'prompt'; text: string; progress?: boolean }
export type RunStatus = 'idle' | 'running' | 'done' | 'error' | 'stopped'

interface OutputState {
  open: boolean
  title: string
  status: RunStatus
  exitCode: number | null
  lines: OutputLine[]
  preview: string | null // HTML shown in the Preview mode
  input: string | null // id of the program's input request, when it is waiting for a typed line
  start: (title: string) => void
  append: (kind: OutputLine['kind'], text: string) => void
  writeOutput: (kind: OutputLine['kind'], text: string, mode: 'line' | 'progress' | 'end') => void
  finish: (status: RunStatus, exitCode: number | null) => void
  showPreview: (html: string, title: string) => void
  requestInput: (id: string) => void
  answered: (text: string) => void
  clearInput: () => void
  clear: () => void
  close: () => void
}

export const outputStore = create<OutputState>()((set) => ({
  open: false,
  title: '',
  status: 'idle',
  exitCode: null,
  lines: [],
  preview: null,
  input: null,
  start: (title) => set({ open: true, title, status: 'running', exitCode: null, lines: [], preview: null, input: null }),
  append: (kind, text) => set((s) => ({ lines: [...s.lines, { kind, text }] })),
  // "progress" replaces the line above it (like \r), "end" finishes a progress line, "line" adds a new line
  writeOutput: (kind, text, mode) =>
    set((s) => {
      const last = s.lines[s.lines.length - 1]
      if (mode === 'progress') {
        const line = { kind, text, progress: true }
        return { lines: last && last.progress ? [...s.lines.slice(0, -1), line] : [...s.lines, line] }
      }
      if (mode === 'end' && last && last.progress) {
        return { lines: [...s.lines.slice(0, -1), { kind: last.kind, text: last.text }] }
      }
      if (mode === 'end') return { lines: [...s.lines, { kind, text: '' }] }
      return { lines: [...s.lines, { kind, text }] }
    }),
  // A finished run ends with a new prompt, like a terminal
  finish: (status, exitCode) =>
    set((s) => ({
      status,
      exitCode,
      input: null,
      lines: status === 'running' ? s.lines : [...s.lines, { kind: 'prompt', text: PROMPT }],
    })),
  showPreview: (html, title) =>
    set({ open: true, title, status: 'done', exitCode: null, lines: [], preview: html, input: null }),
  requestInput: (id) => set({ open: true, input: id }),
  // The typed line is shown in the output, like a terminal
  answered: (text) =>
    set((s) => {
      const last = s.lines[s.lines.length - 1]
      // A prompt ends with a space, so the answer goes on the same line as the prompt
      if (last && last.kind === 'log' && /\s$/.test(last.text)) {
        return { input: null, lines: [...s.lines.slice(0, -1), { kind: 'log', text: last.text + text }] }
      }
      return { input: null, lines: [...s.lines, { kind: 'log', text }] }
    }),
  clearInput: () => set({ input: null }),
  clear: () => set({ lines: [] }),
  close: () => set({ open: false }),
}))