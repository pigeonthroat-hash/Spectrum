import { listPaths, readLines, executeTool } from '../agent/tools'
import { errorText } from '../errors'
import { storageFor } from '../storage/active'
import { cachedText, rememberText, cachedListing, rememberListing, clearReadCache } from '../agent/readCache'
import { outputStore } from '../run/outputStore'
import { forgetPath } from '../files/forget'

// Runs Python in a background thread. Stops it if it takes too long.
const TIMEOUT_MS = 600_000 // 10 minutes; Stop works at any time

export interface PyResult {
  output: string
  error?: string
}

let worker: Worker | null = null
let nextRunId = 1
let cancelActive: (() => void) | null = null

// Typed input: the service worker holds input requests until the Output panel answers them
const STDIN_WORKER = 'stdin-sw.js'
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(import.meta.env.BASE_URL + STDIN_WORKER).catch(() => {
    // Without the worker, input() will report that typed input is not available
  })
}

// The address the Python worker asks for typed lines at
function stdinPath(): string {
  const controller = navigator.serviceWorker?.controller
  return new URL('__spectrum_stdin', controller ? controller.scriptURL : location.href).href
}

// Called by the Output panel when the user presses Enter on an input line
export function answerInput(id: string, text: string): void {
  navigator.serviceWorker?.controller?.postMessage({ id, value: text })
  outputStore.getState().answered(text)
}

// Stop: ends the Python program right away, even while it waits for input
export function cancelPython(): void {
  if (cancelActive) cancelActive()
}

function getWorker(): Worker {
  if (!worker) worker = new Worker(new URL('./pyWorker.ts', import.meta.url), { type: 'module' })
  return worker
}

// Answers file requests from Python, using the current project
// Paths from Python: relative, no ".." and no empty names
function safePath(p: unknown): string {
  const clean = String(p ?? '').trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!clean || clean.split('/').some((seg) => seg === '..')) throw new Error(`Bad file path: "${String(p)}"`)
  return clean
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

// What the current run did with files: new reads, repeat reads, and whether it changed anything
let runStats = { newReads: 0, rereads: 0, changed: false }

export function pythonRunStats() {
  return { ...runStats }
}

function resetRunStats() {
  runStats = { newReads: 0, rereads: 0, changed: false }
}

// Reads a file, using this reply's cache when it was already read
async function readText(projectId: string, path: string): Promise<string> {
  const clean = safePath(path)
  const hit = cachedText(clean)
  if (hit !== undefined) {
    runStats.rereads++
    return hit
  }
  runStats.newReads++
  const text = await storageFor(projectId).readFile(clean)
  rememberText(clean, text)
  return text
}

const CHANGE_OPS = ['create', 'write', 'write_bytes', 'edit', 'copy', 'move', 'delete', 'mkdir']

async function handleFs(projectId: string | null, op: string, argsJson: string): Promise<string> {
  if (!projectId) throw new Error('Open a project first, so Python can reach its files.')
  const args = JSON.parse(argsJson) as unknown[]
  const storage = storageFor(projectId)
  if (CHANGE_OPS.includes(op)) {
    clearReadCache()
    runStats.changed = true
  }
  switch (op) {
    case 'list': {
      const hit = cachedListing()
      if (hit) {
        runStats.rereads++
        return JSON.stringify(hit)
      }
      runStats.newReads++
      const paths = await listPaths(projectId)
      rememberListing(paths)
      return JSON.stringify(paths)
    }
    case 'read': {
      const [path, start, end] = args as [string, unknown, unknown]
      return readLines(await readText(projectId, path), start, end)
    }
    case 'read_many': {
      // Many files in one call. A missing file shows an error in its place.
      // Accepts [[paths]] (from the helper) or [paths]
      const paths = (Array.isArray(args[0]) ? args[0] : args) as string[]
      const out: Record<string, string> = {}
      for (const p of paths) {
        try {
          out[p] = await readText(projectId, p)
        } catch (err) {
          out[p] = 'ERROR: ' + errorText(err)
        }
      }
      return JSON.stringify(out)
    }
    case 'read_bytes': {
      const [path] = args as [string]
      return bytesToBase64(await storage.readBytes(safePath(path)))
    }
    case 'create': {
      const [path, content] = args as [string, string]
      return executeTool(projectId, 'create_file', { path: safePath(path), content })
    }
    case 'write': {
      // New file: created. Existing file: a full-rewrite proposal the user reviews.
      const [path, content] = args as [string, string]
      const clean = safePath(path)
      if (!(await listPaths(projectId)).includes(clean)) {
        return executeTool(projectId, 'create_file', { path: clean, content })
      }
      return executeTool(projectId, 'write_file', { path: clean, content })
    }
    case 'write_bytes': {
      // Binary file (for example a zip). Only for new files.
      const [path, b64] = args as [string, string]
      const clean = safePath(path)
      if ((await listPaths(projectId)).includes(clean)) throw new Error(`${clean} already exists.`)
      await storage.writeBytes(clean, base64ToBytes(b64))
      return `Created ${clean}.`
    }
    case 'edit': {
      const [path, find, replace] = args as [string, string, string]
      return executeTool(projectId, 'edit_file', { path: safePath(path), find, replace })
    }
    case 'copy': {
      const [src, dst] = args as [string, string]
      const from = safePath(src)
      const to = safePath(dst)
      if ((await listPaths(projectId)).includes(to)) throw new Error(`${to} already exists.`)
      await storage.writeBytes(to, await storage.readBytes(from))
      return `Copied ${from} to ${to}.`
    }
    case 'move': {
      const [src, dst] = args as [string, string]
      const from = safePath(src)
      const to = safePath(dst)
      await storage.rename(from, to)
      return `Moved ${from} to ${to}.`
    }
    case 'delete': {
      const [path] = args as [string]
      const clean = safePath(path)
      await storage.remove(clean)
      forgetPath(clean)
      return `Deleted ${clean}.`
    }
    case 'mkdir': {
      const [path] = args as [string]
      const clean = safePath(path)
      await storage.createFolder(clean)
      return `Created folder ${clean}.`
    }
    default:
      throw new Error(`Unknown file action: ${op}`)
  }
}

// Runs Python code. streamToPanel sends the output to the Output panel as it is printed.
export function runPython(
  projectId: string | null,
  code: string,
  onStatus?: (text: string) => void,
  streamToPanel = false
): Promise<PyResult> {
  resetRunStats()
  return new Promise((resolve) => {
    const w = getWorker()
    const id = nextRunId++

    const finish = (result: PyResult) => {
      clearTimeout(timer)
      w.removeEventListener('message', onMessage)
      if (cancelActive === cancel) cancelActive = null
      outputStore.getState().clearInput()
      resolve(result)
    }

    const cancel = () => {
      w.terminate()
      if (worker === w) worker = null
      finish({ output: '', error: 'Stopped.' })
    }
    cancelActive = cancel

    const onMessage = async (e: MessageEvent) => {
      const m = e.data
      if (m.type === 'status') {
        onStatus?.(m.text)
        return
      }
      if (m.type === 'input-request') {
        outputStore.getState().requestInput(String(m.id))
        return
      }
      if (m.type === 'out') {
        if (streamToPanel && m.id === id) outputStore.getState().writeOutput(m.err ? 'error' : 'log', m.text, m.mode)
        return
      }
      if (m.type === 'fs') {
        try {
          w.postMessage({ type: 'fsResult', id: m.id, value: await handleFs(projectId, m.op, m.args) })
        } catch (err) {
          w.postMessage({ type: 'fsResult', id: m.id, error: err instanceof Error ? err.message : String(err) })
        }
        return
      }
      if (m.type === 'done' && m.id === id) finish({ output: m.output, error: m.error })
    }

    const timer = setTimeout(() => {
      w.terminate()
      if (worker === w) worker = null
      finish({ output: '', error: 'Python took too long and was stopped.' })
    }, TIMEOUT_MS)

    w.addEventListener('message', onMessage)
    // A random token makes input IDs unique across browser tabs, so input goes only to the tab that ran the code
    w.postMessage({ type: 'run', id, token: crypto.randomUUID(), code, stdinPath: stdinPath() })
  })
}