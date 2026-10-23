export interface ShortcutItem {
  label: string
  keys: string[]
}

export interface ShortcutGroup {
  title: string
  items: ShortcutItem[]
}

// Shortcuts that are working in Spectrum now
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Review changes',
    items: [
      { label: 'Accept this change', keys: ['Ctrl', 'Enter'] },
      { label: 'Reject this change', keys: ['Ctrl', 'Backspace'] },
      { label: 'Next change', keys: ['Alt', '↓'] },
      { label: 'Previous change', keys: ['Alt', '↑'] },
    ],
  },
  {
    title: 'Layout',
    items: [
      { label: 'Toggle explorer', keys: ['Ctrl', 'B'] },
      { label: 'Toggle chat', keys: ['Ctrl', 'Alt', 'B'] },
    ],
  },
  {
    title: 'Editor',
    items: [{ label: 'Save file', keys: ['Ctrl', 'S'] }],
  },
]