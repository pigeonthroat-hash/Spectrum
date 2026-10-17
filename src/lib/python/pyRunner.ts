import { listPaths, readLines, createNew } from '../agent/tools'
import { storageFor } from '../storage/active'
import { outputStore } from '../run/outputStore'

// Runs Python in a background thread. Stops it if it takes too long.
const TIMEOUT_MS = 90_000

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
async function handleFs(projectId: string | null, op: string, argsJson: string): Promise<string> {
  if (!projectId) throw new Error('Open a project first, so Python can reach its files.')
  const args = JSON.parse(argsJson) as unknown[]
  switch (op) {
    case 'list':
      return JSON.stringify(await listPaths(projectId))
    case 'read': {
      const [path, start, end] = args as [string, unknown, unknown]
      return readLines(await storageFor(projectId).readFile(path), start, end)
    }
    case 'create': {
      const [path, content] = args as [string, string]
      await createNew(projectId, path, content)
      return 'ok'
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
        if (streamToPanel && m.id === id) outputStore.getState().append(m.err ? 'error' : 'log', m.text)
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
    w.postMessage({ type: 'run', id, code, stdinPath: stdinPath() })
  })
}