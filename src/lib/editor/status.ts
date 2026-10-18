import { create } from 'zustand'

// Cursor position and file settings for the status bar
export interface EditorStatus {
  line: number
  column: number
  tabSize: number
  eol: 'LF' | 'CRLF'
}

export const useEditorStatus = create<EditorStatus>()(() => ({ line: 1, column: 1, tabSize: 4, eol: 'LF' }))

// The parts of Monaco's editor this needs
interface MonacoLikeEditor {
  onDidChangeCursorPosition: (fn: () => void) => unknown
  onDidChangeModel: (fn: () => void) => unknown
  getPosition: () => { lineNumber: number; column: number } | null
  getModel: () => { getOptions: () => { tabSize: number }; getEOL: () => string } | null
}

// Keeps the status bar in step with the editor
export function attachEditorStatus(editor: MonacoLikeEditor): void {
  const update = () => {
    const p = editor.getPosition()
    const model = editor.getModel()
    useEditorStatus.setState({
      line: p?.lineNumber ?? 1,
      column: p?.column ?? 1,
      tabSize: model?.getOptions().tabSize ?? 4,
      eol: model?.getEOL() === '\r\n' ? 'CRLF' : 'LF',
    })
  }
  editor.onDidChangeCursorPosition(update)
  editor.onDidChangeModel(update)
  update()
}