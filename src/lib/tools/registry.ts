import { runPython } from '../python/pyRunner'
import { forgetPath } from '../files/forget'
import { useAppStore } from '../../store/useAppStore'
import { storageFor } from '../storage/active'
import type { FileNode } from '../storage/types'
import { listPaths, executeTool } from '../agent/tools'

// One list of every tool. The chat agent, the @ menu, and Settings all read from here.
// available: false means the tool needs something that isn't set up yet (a server function or the desktop app).
export interface ToolDef {
  name: string
  aliases?: string[]
  category: 'files' | 'search' | 'system' | 'web' | 'integrations'
  description: string
  params: Record<string, unknown>
  required: string[]
  risky: boolean // asks every time by default
  optional?: boolean // shown in the @ menu; the rest are always on
  label?: string // name shown in the menu
  available: boolean
  needs?: string // why it is not available yet
  run?: (projectId: string | null, args: Record<string, unknown>) => Promise<string>
}

const str = (description: string) => ({ type: 'string', description })
const bool = (description: string) => ({ type: 'boolean', description })

function need(projectId: string | null): string {
  if (!projectId) throw new Error('Open a project first.')
  return projectId
}

// Folder lookup helpers
function findNode(nodes: FileNode[], path: string): FileNode | undefined {
  for (const n of nodes) {
    if (n.path === path) return n
    if (n.children) {
      const found = findNode(n.children, path)
      if (found) return found
    }
  }
  return undefined
}

async function listDir(projectId: string | null, args: Record<string, unknown>): Promise<string> {
  const storage = storageFor(need(projectId))
  const tree = await storage.listTree()
  const folder = String(args.path ?? '').trim().replace(/^\/+|\/+$/g, '')
  let nodes = tree
  if (folder) {
    const node = findNode(tree, folder)
    if (!node || node.type !== 'folder') throw new Error(`There is no folder named ${folder}.`)
    nodes = node.children ?? []
  }
  const lines: string[] = []
  const walk = (list: FileNode[], depth: number) => {
    for (const n of list) {
      if (lines.length >= 300) return
      lines.push('  '.repeat(depth) + n.name + (n.type === 'folder' ? '/' : ''))
      if (n.type === 'folder') walk(n.children ?? [], depth + 1)
    }
  }
  walk(nodes, 0)
  if (lines.length >= 300) lines.push('...more items not shown')
  return lines.length ? lines.join('\n') : 'Empty folder.'
}

// Glob to regular expression: ** any folders, * any name characters, ? one character
function globToRegex(glob: string): RegExp {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*'
      i++
      if (glob[i + 1] === '/') i++
    } else if (c === '*') {
      re += '[^/]*'
    } else if (c === '?') {
      re += '[^/]'
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp('^' + re + '$')
}

async function glob(projectId: string | null, args: Record<string, unknown>): Promise<string> {
  const pattern = String(args.pattern ?? '').trim()
  if (!pattern) throw new Error('The pattern is empty.')
  const re = globToRegex(pattern.replace(/^\/+/, ''))
  const matches = (await listPaths(need(projectId))).filter((p) => re.test(p))
  if (matches.length === 0) return 'No files match.'
  return matches.slice(0, 200).join('\n') + (matches.length > 200 ? `\n...and ${matches.length - 200} more` : '')
}

async function grep(projectId: string | null, args: Record<string, unknown>): Promise<string> {
  const pattern = String(args.pattern ?? '')
  if (!pattern) throw new Error('The search pattern is empty.')
  const source = args.regex === true ? pattern : pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let re: RegExp
  try {
    re = new RegExp(source, 'i')
  } catch {
    throw new Error('That is not a valid regular expression.')
  }
  const include = args.include ? globToRegex(String(args.include).replace(/^\/+/, '')) : null
  const storage = storageFor(need(projectId))
  const hits: string[] = []
  for (const path of await listPaths(need(projectId))) {
    if (include && !include.test(path)) continue
    let text: string
    try {
      text = await storage.readFile(path)
    } catch {
      continue
    }
    if (text.length > 1_000_000) continue
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        hits.push(`${path}:${i + 1}: ${lines[i].trim().slice(0, 160)}`)
        if (hits.length >= 80) return hits.join('\n') + '\n...more matches not shown'
      }
    }
  }
  return hits.length ? hits.join('\n') : 'No matches.'
}

// Problems Monaco (the editor) reports for open files: errors, warnings, TypeScript diagnostics
async function readLints(_projectId: string | null, args: Record<string, unknown>): Promise<string> {
  const monaco = (window as unknown as { monaco?: { editor: { getModelMarkers: (f: object) => MonacoMarker[] } } }).monaco
  if (!monaco) return 'Problem checking is not ready yet. Open the file in the editor and try again.'
  const wanted = String(args.path ?? '').trim()
  const tabs = useAppStore.getState().openTabs.filter((t) => !wanted || t.path === wanted)
  if (tabs.length === 0) return wanted ? `${wanted} is not open in the editor. Open it to check it.` : 'No files are open in the editor.'
  const markers = monaco.editor.getModelMarkers({})
  const names = ['', '', 'info', '', 'warning', '', '', '', 'error']
  const lines: string[] = []
  for (const tab of tabs) {
    for (const m of markers) {
      const p = m.resource?.path ?? ''
      if (p === '/' + tab.path || p.endsWith('/' + tab.path)) {
        lines.push(`${tab.path}:${m.startLineNumber}: ${names[m.severity] || 'problem'}: ${m.message}`)
      }
    }
  }
  if (lines.length === 0) return 'No problems found.'
  return lines.slice(0, 60).join('\n')
}

// Deletes a file after you confirm. The review screen version comes with the approval settings.
async function deleteFile(projectId: string | null, args: Record<string, unknown>): Promise<string> {
  const path = String(args.path ?? '').trim()
  if (!path) throw new Error('The file path is empty.')
  const project = need(projectId)
  if (!window.confirm(`The AI wants to delete ${path}. This can't be undone. Delete it?`)) {
    return `The user did not allow deleting ${path}.`
  }
  const storage = storageFor(project)
  await storage.remove(path)
  forgetPath(path)
  useAppStore.getState().setFileTree(await storage.listTree())
  return `Deleted ${path}.`
}

// Writes a new file, or rewrites an existing one (through the same review as edits)
async function writeFile(projectId: string | null, args: Record<string, unknown>): Promise<string> {
  const path = String(args.path ?? '').trim()
  const exists = (await listPaths(need(projectId))).includes(path)
  return executeTool(projectId, exists ? 'write_file' : 'create_file', args)
}

const RAW_TOOLS: ToolDef[] = [
  // Python: calculations, checking code, and file jobs
  {
    name: 'run_python', category: 'system', risky: false, available: true,
    description: 'Run Python and return its printed output. Use it for calculations, checking code, and file jobs (read_files, write_file, copy_file, zip_files, list_files, read_file).',
    params: { code: str('Python code. Use print() to show results.') },
    required: ['code'],
    run: async (projectId, args) => {
      const r = await runPython(projectId, String(args.code ?? ''))
      return [r.output.trim(), r.error ?? ''].filter(Boolean).join('\n') || '(no output)'
    },
  },
  // Files
  {
    name: 'read_file', category: 'files', risky: false, available: true,
    description: 'Read a project file, or a range of lines.',
    params: { path: str('File path'), start: { type: 'integer', description: 'First line (optional)' }, end: { type: 'integer', description: 'Last line (optional)' } },
    required: ['path'],
    run: (p, a) => executeTool(p, 'read_file', a),
  },
  {
    name: 'write_file', aliases: ['create_file'], category: 'files', risky: false, available: true,
    description: 'Write a new file, or rewrite an existing file from scratch. The user reviews changes to existing files.',
    params: { path: str('File path'), content: str('Full file content') },
    required: ['path', 'content'],
    run: writeFile,
  },
  {
    name: 'edit_file', aliases: ['str_replace'], category: 'files', risky: false, available: true,
    description: 'Propose a targeted change to an existing file: replaces the exact text in "find" with "replace". "find" must match exactly once.',
    params: { path: str('File path'), find: str('Exact text to replace'), replace: str('New text') },
    required: ['path', 'find', 'replace'],
    run: (p, a) => executeTool(p, 'edit_file', a),
  },
  {
    name: 'delete_file', category: 'files', risky: true, available: true,
    description: 'Delete a file from the project. Asks the user first.',
    params: { path: str('File path to delete') },
    required: ['path'],
    run: deleteFile,
  },
  {
    name: 'list_dir', category: 'files', risky: false, available: true,
    description: 'List the folders and files in a folder, as a tree. Empty path means the project root.',
    params: { path: str('Folder path (optional)') },
    required: [],
    run: listDir,
  },
  // Search
  {
    name: 'glob', aliases: ['glob_file_search'], category: 'search', risky: false, available: true,
    description: 'Find file paths by name pattern, e.g. "src/**/*.tsx" or "*.html".',
    params: { pattern: str('Pattern using * ** ?') },
    required: ['pattern'],
    run: glob,
  },
  {
    name: 'grep', aliases: ['grep_search'], category: 'search', risky: false, available: true,
    description: 'Search file contents for text, or a regular expression, and list matching lines.',
    params: { pattern: str('Text or regular expression'), regex: bool('Treat pattern as a regular expression'), include: str('Only search files matching this glob (optional)') },
    required: ['pattern'],
    run: grep,
  },
  {
    name: 'codebase_search', aliases: ['semantic_search'], category: 'search', risky: false, available: false,
    description: 'Search the project by meaning, not just keywords.',
    params: { query: str('What you are looking for') },
    required: ['query'],
    needs: 'it needs a searchable index of the project, which is not built yet',
  },
  // System
  {
    name: 'read_lints', category: 'system', risky: false, available: true,
    description: 'List the errors and warnings the editor reports for open files. Give a path to check one file.',
    params: { path: str('File path (optional)') },
    required: [],
    run: readLints,
  },
  {
    name: 'run_terminal_command', aliases: ['shell'], category: 'system', risky: true, available: false,
    description: 'Run a terminal command (build scripts, installs).',
    params: { command: str('Command to run') },
    required: ['command'],
    needs: 'a real terminal needs the desktop app',
  },
  {
    name: 'edit_notebook', category: 'system', risky: false, available: false,
    description: 'Edit and run cells in a Jupyter notebook (.ipynb).',
    params: { path: str('Notebook path'), cell: { type: 'integer', description: 'Cell number' }, source: str('New cell source') },
    required: ['path', 'cell', 'source'],
    needs: 'Spectrum does not support notebooks yet',
  },
  // Web and media
  {
    name: 'web_search', category: 'web', risky: false, available: false,
    description: 'Search the web for documentation and API references.',
    params: { query: str('Search query') },
    required: ['query'],
    needs: 'it needs a search service set up on the server',
  },
  {
    name: 'web_fetch', aliases: ['browser'], category: 'web', risky: true, available: false,
    description: 'Load a web page and return its text.',
    params: { url: str('Address to load') },
    required: ['url'],
    needs: 'it needs a fetch service set up on the server',
  },
  {
    name: 'generate_image', category: 'web', risky: true, available: false,
    description: 'Generate an image from a text description.',
    params: { prompt: str('What to draw') },
    required: ['prompt'],
    needs: 'it needs an image service set up on the server, and it costs money per image',
  },
  // Integrations
  {
    name: 'call_mcp_tool', category: 'integrations', risky: true, available: false,
    description: 'Call a tool on a connected MCP server.',
    params: { server: str('Server name'), tool: str('Tool name'), arguments: { type: 'object', description: 'Arguments' } },
    required: ['server', 'tool'],
    needs: 'Spectrum does not connect to MCP servers yet',
  },
  {
    name: 'fetch_mcp_resource', category: 'integrations', risky: false, available: false,
    description: 'Read a resource from a connected MCP server.',
    params: { server: str('Server name'), uri: str('Resource address') },
    required: ['server', 'uri'],
    needs: 'Spectrum does not connect to MCP servers yet',
  },
]

type MonacoMarker = { resource?: { path: string }; startLineNumber: number; severity: number; message: string }

// Tools that are off until turned on in the @ menu. Everything else is always on.
const OPTIONAL = new Set([
  'web_search', 'web_fetch', 'generate_image', 'delete_file', 'run_terminal_command',
  'codebase_search', 'edit_notebook', 'call_mcp_tool', 'fetch_mcp_resource',
])

const LABELS: Record<string, string> = {
  web_search: 'Web Search', web_fetch: 'Fetch Web Page', generate_image: 'Generate Image',
  delete_file: 'Delete File', run_terminal_command: 'Run Terminal Command', codebase_search: 'Codebase Search',
  edit_notebook: 'Edit Notebook', call_mcp_tool: 'Call MCP Tool', fetch_mcp_resource: 'Fetch MCP Resource',
}

export const TOOLS: ToolDef[] = RAW_TOOLS.map((t) => ({
  ...t,
  optional: OPTIONAL.has(t.name),
  label: LABELS[t.name] ?? t.name,
}))

// Tools the chat agent can call, in the format the model expects
export function toolSpecs(names?: string[]) {
  return TOOLS.filter((t) => t.available && t.run && (!t.optional || !names || names.includes(t.name))).map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: { type: 'object', properties: t.params, required: t.required },
    },
  }))
}

// The main name for a tool, even when called by an alias
export function canonicalName(name: string): string {
  return TOOLS.find((t) => t.name === name || t.aliases?.includes(name))?.name ?? name
}

// Runs a tool by its name or alias
export async function runRegistryTool(projectId: string | null, name: string, args: Record<string, unknown>): Promise<string> {
  const tool = TOOLS.find((t) => t.name === name || t.aliases?.includes(name))
  if (!tool) {
    throw new Error(`Unknown tool "${name}". Available tools: ${TOOLS.filter((t) => t.available).map((t) => t.name).join(', ')}.`)
  }
  if (!tool.available || !tool.run) throw new Error(`${tool.name} is not available yet: ${tool.needs}.`)
  return tool.run(projectId, args)
}