// Short notes the AI keeps for each project, saved in this browser
const KEY = (id: string) => `spectrum-memory:${id}`
const MAX_NOTES = 30

export function loadMemory(id: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY(id)) ?? '[]')
    return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function save(id: string, notes: string[]) {
  localStorage.setItem(KEY(id), JSON.stringify(notes.slice(-MAX_NOTES)))
}

export function addMemory(id: string, note: string): void {
  const clean = note.trim().slice(0, 200)
  if (!clean) throw new Error('The note is empty.')
  save(id, [...loadMemory(id).filter((n) => n !== clean), clean])
}

export function removeMemory(id: string, match: string): number {
  const needle = match.trim().toLowerCase()
  if (!needle) throw new Error('The match text is empty.')
  const notes = loadMemory(id)
  const kept = notes.filter((n) => !n.toLowerCase().includes(needle))
  save(id, kept)
  return notes.length - kept.length
}