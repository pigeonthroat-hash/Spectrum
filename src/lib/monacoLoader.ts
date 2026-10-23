import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'

// Use the copy of Monaco that ships with the app, not one loaded from a CDN at runtime.
// Syntax colours then never depend on a network request.
loader.config({ monaco })

// The warm editor theme: the same colours as the rest of the app
monaco.editor.defineTheme('spectrum-warm', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#201d18',
    'editorGutter.background': '#201d18',
    'editor.lineHighlightBackground': '#2a261f',
    'editor.lineHighlightBorder': '#2a261f',
    'editorLineNumber.foreground': '#5c554a',
    'editorLineNumber.activeForeground': '#ece6da',
    'editor.selectionBackground': '#3d3527',
    'editor.inactiveSelectionBackground': '#302b22',
    'editorCursor.foreground': '#f0a93b',
    'editorWidget.background': '#1a1814',
    'editorWidget.border': '#2d2921',
    'minimap.background': '#201d18',
    'scrollbarSlider.background': '#3a342a80',
    'diffEditor.insertedTextBackground': '#1b3a2440',
    'diffEditor.removedTextBackground': '#4a1d2440',
  },
})
