import { storageFor } from '../storage/active'
import { cachedText, rememberText } from './readCache'
import type { FileNode } from '../storage/types'
import { addMemory, removeMemory } from './memory'
import { useAppStore } from '../../store/useAppStore'
import { isAutoApplyOn } from './autoApply'
import { waitForDecision } from './decisions'
import { runRegistryTool } from '../tools/registry'

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
export async function createAndRefresh(projectId: string, path: string, content: string): Promise<void> {
  await createNew(projectId, path, content)
  useAppStore.getState().setFileTree(await storageFor(projectId).listTree())
}

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
      const hit = cachedText(path)
      const text = hit ?? (await storageFor(need(projectId)).readFile(path))
      if (hit === undefined) rememberText(path, text)
      return readLines(text, args.start, args.end).slice(0, MAX_TOOL_OUTPUT)
    }
    case 'search_files':
      return searchFiles(need(projectId), String(args.query ?? ''))
    case 'create_file': {
      const path = String(args.path ?? '').trim()
      const project = need(projectId)
      const content = String(args.content ?? '')
      if ((await listPaths(project)).includes(path)) {
        throw new Error(`${path} already exists. Only new files can be created.`)
      }
      if (isAutoApplyOn()) {
        await createAndRefresh(project, path, content)
        return `Created ${path}. Continue with the next step.`
      }
      const store = useAppStore.getState()
      store.setPendingDiffs([...store.pendingDiffs.filter((d) => d.path !== path), { path, original: '', modified: content }])
      store.openFile(path, path.split('/').pop() ?? path, content)
      const outcome = await waitForDecision(path, 'create')
      if (outcome === 'applied') return `Created ${path}.`
      if (outcome === 'declined') return `The user declined to create ${path}.`
      return `Creating ${path} was cancelled.`
    }
    case 'edit_file': {
      const path = String(args.path ?? '').trim()
      const find = String(args.find ?? '')
      const replace = String(args.replace ?? '')
      const original = await storageFor(need(projectId)).readFile(path)
      // Match line breaks the way the file has them (Windows files use \r\n)
      const eol = original.includes('\r\n') ? '\r\n' : '\n'
      const findText = find.replace(/\r?\n/g, eol)
      const replaceText = replace.replace(/\r?\n/g, eol)
      // An empty find is only allowed for an empty file: replace then becomes the whole file
      if (!find && original.trim() !== '') {
        throw new Error(`${path} already has content. Put the exact text to replace in find.`)
      }
      const count = find ? original.split(findText).length - 1 : 1
      if (count === 0) {
        throw new Error(`The text to find was not in ${path}. Read the file again and copy the exact text. Do not repeat the same edit.`)
      }
      if (count > 1) {
        throw new Error(`The text to find appears ${count} times in ${path}. Use a longer, unique piece of text.`)
      }
      const modified = find ? original.replace(findText, () => replaceText) : replaceText
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
      const outcome = await waitForDecision(path, 'edit')
      if (outcome === 'applied') return `Applied the change to ${path}.`
      if (outcome === 'declined') return `The user declined the change to ${path}.`
      return `The change to ${path} was cancelled.`
    }
    case 'write_file': {
      // Full rewrite of an existing file. Goes through the same review as edit_file.
      const path = String(args.path ?? '').trim()
      if (!(await listPaths(need(projectId))).includes(path)) {
        // A new file goes through the same review as create_file
        return executeTool(projectId, 'create_file', { path, content: String(args.content ?? '') })
      }
      const original = await storageFor(need(projectId)).readFile(path)
      const modified = String(args.content ?? '')
      const store = useAppStore.getState()
      store.setPendingDiffs([...store.pendingDiffs.filter((d) => d.path !== path), { path, original, modified }])
      if (!store.openTabs.some((t) => t.path === path)) {
        store.openFile(path, path.split('/').pop() ?? path, original)
      } else {
        store.setActiveTab(path)
      }
      if (isAutoApplyOn()) {
        useAppStore.getState().acceptDiff(path)
        return `Applied the change to ${path}. Continue with the next step.`
      }
      const outcome = await waitForDecision(path, 'edit')
      if (outcome === 'applied') return `Applied the change to ${path}.`
      if (outcome === 'declined') return `The user declined the change to ${path}.`
      return `The change to ${path} was cancelled.`
    }
    case 'remember':
      addMemory(memoryId, String(args.note ?? ''))
      return 'Saved the note.'
    case 'forget': {
      const removed = removeMemory(memoryId, String(args.match ?? ''))
      return `Removed ${removed} note(s).`
    }
    default:
      return runRegistryTool(projectId, name, args)
  }
}