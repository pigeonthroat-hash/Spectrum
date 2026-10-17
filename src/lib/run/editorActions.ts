import { runActiveFile } from './runActive'

// Adds "Run File" to the editor's right-click menu
export function registerEditorActions(editor: {
  addAction: (action: {
    id: string
    label: string
    contextMenuGroupId?: string
    contextMenuOrder?: number
    run: () => void
  }) => unknown
}): void {
  editor.addAction({
    id: 'spectrum.runFile',
    label: 'Run File',
    contextMenuGroupId: 'navigation',
    contextMenuOrder: 0,
    run: () => {
      void runActiveFile()
    },
  })
}