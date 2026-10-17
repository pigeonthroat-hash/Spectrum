import { storageFor } from '../storage/active'
import type { FileNode } from '../storage/types'
import { addMemory, removeMemory } from './memory'
import { useAppStore } from '../../store/useAppStore'
import { isAutoApplyOn } from './autoApply'

const MAX_TOOL_OUTPUT = 8000

export async function listPaths(projectId: string): Promise<string[]> {
  const tree = await storageFor(projectId).listTree()
  const paths: string[] = []
  const walk = (nodes: FileNode[]) => {
    for (const n of nodes) {
      if (n.type === 'file') paths.push(n.path)
      else if (n.children) walk(n.children)
    }
  }
  walk(tree)
  return paths.sort()
}

// Lines start..end (1-based), with a header saying which lines were shown
export function readLines(text: string, start?: unknown, end?: unknown): string {
  const lines = text.split('\n')
  const s = Math.max(1, Number(start) || 1)
  const e = Math.min(lines.length, Number(end) || s + 199)
  return `(lines ${s}-${e} of ${lines.length})\n` + lines.slice(s - 1, e).join('\n')
}

// Creates a new file. Existing files are not overwritten.
export async function createNew(projectId: string, path: string, content: string): Promise<void> {
  const clean = path.trim().replace(/^\/+/, '')
  if (!clean) throw new Error('The file path is empty.')
  const existing = await listPaths(projectId)
  if (existing.includes(clean)) throw new Error(`${clean} already exists. Only new files can be created for now.`)
  await storageFor(projectId).writeFile(clean, content)
}

async function searchFiles(projectId: string, query: string): Promise<string> {
  const q = query.trim().toLowerCase()
  if (!q) throw new Error('The search text is empty.')
  const storage = storageFor(projectId)
  const hits: string[] = []
  for (const path of (await listPaths(projectId)).slice(0, 60)) {
    let text: string
    try {
      text = await storage.readFile(path)
    } catch {
      continue
    }
    const lines = text.split('\n')
    for (let i = 0; i < lines.length && hits.length < 40; i++) {
      if (lines[i].toLowerCase().includes(q)) hits.push(`${path}:${i + 1}: ${lines[i].trim().slice(0, 160)}`)
    }
    if (hits.length >= 40) break
  }
  return hits.length ? hits.join('\n') : 'No matches.'
}

function need(projectId: string | null): string {
  if (!projectId) throw new Error('Open a project first.')
  return projectId
}

// Runs one tool by name. Returns text for the AI to read.
export async function executeTool(
  projectId: string | null,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const memoryId = projectId ?? 'no-project'
  switch (name) {
    case 'list_files': {
      const paths = await listPaths(need(projectId))
      if (paths.length === 0) return 'No files.'
      const shown = paths.slice(0, 300).join('\n')
      return paths.length > 300 ? `${shown}\n...and ${paths.length - 300} more` : shown
    }
    case 'read_file': {
      const path = String(args.path ?? '')
      const text = await storageFor(need(projectId)).readFile(path)
      return readLines(text, args.start, args.end).slice(0, MAX_TOOL_OUTPUT)
    }
    case 'search_files':
      return searchFiles(need(projectId), String(args.query ?? ''))
    case 'create_file': {
      const path = String(args.path ?? '').trim()
      await createNew(need(projectId), path, String(args.content ?? ''))
      return `Created ${path}.`
    }
    case 'edit_file': {
      const path = String(args.path ?? '').trim()
      const find = String(args.find ?? '')
      const replace = String(args.replace ?? '')
      if (!find) throw new Error('find must not be empty.')
      const original = await storageFor(need(projectId)).readFile(path)
      const count = original.split(find).length - 1
      if (count === 0) {
        throw new Error(`The text to find was not in ${path}. Read the file again and copy the exact text.`)
      }
      if (count > 1) {
        throw new Error(`The text to find appears ${count} times in ${path}. Use a longer, unique piece of text.`)
      }
      const modified = original.replace(find, () => replace)
      const store = useAppStore.getState()
      store.setPendingDiffs([...store.pendingDiffs.filter((d) => d.path !== path), { path, original, modified }])
      // Open the file so the proposed change shows in the editor
      if (!store.openTabs.some((t) => t.path === path)) {
        store.openFile(path, path.split('/').pop() ?? path, original)
      } else {
        store.setActiveTab(path)
      }
      if (isAutoApplyOn()) {
        useAppStore.getState().acceptDiff(path)
        return `Applied the change to ${path}. Continue with the next step.`
      }
      return `Proposed a change to ${path}. The user will apply or decline it in the editor.`
    }
    case 'remember':
      addMemory(memoryId, String(args.note ?? ''))
      return 'Saved the note.'
    case 'forget': {
      const removed = removeMemory(memoryId, String(args.match ?? ''))
      return `Removed ${removed} note(s).`
    }
    default:
      throw new Error(
        `Unknown tool "${name}". Use one of: list_files, read_file, search_files, create_file, remember, forget.`
      )
  }
}