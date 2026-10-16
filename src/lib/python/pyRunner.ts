import { listPaths, readLines, createNew } from '../agent/tools'
import { storageFor } from '../storage/active'

// Runs Python in a background thread. Stops it if it takes too long.
const TIMEOUT_MS = 90_000

export interface PyResult {
  output: string
  error?: string
}

let worker: Worker | null = null
let nextRunId = 1

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

export function runPython(projectId: string | null, code: string, onStatus?: (text: string) => void): Promise<PyResult> {
  return new Promise((resolve) => {
    const w = getWorker()
    const id = nextRunId++

    const finish = (result: PyResult) => {
      clearTimeout(timer)
      w.removeEventListener('message', onMessage)
      resolve(result)
    }

    const onMessage = async (e: MessageEvent) => {
      const m = e.data
      if (m.type === 'status') {
        onStatus?.(m.text)
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
    w.postMessage({ type: 'run', id, code })
  })
}