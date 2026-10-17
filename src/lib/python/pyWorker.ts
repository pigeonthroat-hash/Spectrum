import type { PyodideInterface } from 'pyodide'

// Must match the installed pyodide version. Check it with: npm ls pyodide
const PYODIDE_VERSION = '314.0.7'

// Loaded from the CDN at runtime, so Vite doesn't bundle Pyodide (its Node-only parts break in browsers)
type LoadPyodide = (opts: { indexURL: string }) => Promise<PyodideInterface>

type Post = (msg: unknown) => void
const post: Post = (msg) => (self as unknown as { postMessage: Post }).postMessage(msg)

// File requests to the main thread, waiting for answers
const pending = new Map<number, { resolve: (v: string) => void; reject: (e: Error) => void }>()
let nextFsId = 1

function fsCall(op: string, argsJson: string): Promise<string> {
  const id = nextFsId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    post({ type: 'fs', id, op, args: argsJson })
  })
}

// Helper functions that Python code can call
const PRELUDE = `
import json

async def list_files():
    return json.loads(await spectrum_fs("list", "[]"))

async def read_file(path, start=None, end=None):
    return await spectrum_fs("read", json.dumps([path, start, end]))

async def create_file(path, content=""):
    return await spectrum_fs("create", json.dumps([path, content]))
`

let pyodidePromise: Promise<PyodideInterface> | null = null

function getPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    post({ type: 'status', text: 'Loading Python (first time only)...' })
    pyodidePromise = (async () => {
      const cdn = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`
      const mod = (await import(/* @vite-ignore */ `${cdn}pyodide.mjs`)) as { loadPyodide: LoadPyodide }
      const py = await mod.loadPyodide({ indexURL: cdn })
      py.globals.set('spectrum_fs', fsCall)
      await py.runPythonAsync(PRELUDE)
      return py
    })().catch((err) => {
      pyodidePromise = null
      throw err
    })
  }
  return pyodidePromise
}

// Asks the page for one line of typed input. The request stays open until the user types,
// because the service worker holds it (see public/stdin-sw.js). The Python code waits here.
function readLine(id: string, stdinPath: string): string {
  const req = new XMLHttpRequest()
  req.open('GET', stdinPath + '?id=' + encodeURIComponent(id), false)
  req.send()
  if (req.status !== 200) throw new Error('Typed input is not available. Reload the page and try again.')
  return req.responseText
}

self.addEventListener('message', async (e: MessageEvent) => {
  const msg = e.data
  if (msg.type === 'fsResult') {
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.error) p.reject(new Error(msg.error))
    else p.resolve(msg.value)
    return
  }
  if (msg.type === 'run') {
    const out: string[] = []
    let inputs = 0
    const decoder = new TextDecoder()
    // Output arrives byte by byte. \n ends a line. \r goes back to the start of the line,
    // so a countdown or progress bar overwrites itself instead of making a new line.
    const buffers: Record<'out' | 'err', number[]> = { out: [], err: [] }
    const lastWasCR: Record<'out' | 'err', boolean> = { out: false, err: false }
    const emit = (stream: 'out' | 'err', text: string, mode: 'line' | 'progress' | 'end') => {
      if (mode === 'line') out.push(text)
      post({ type: 'out', id: msg.id, text, err: stream === 'err', mode })
    }
    const sendPartial = (stream: 'out' | 'err') => {
      if (buffers[stream].length === 0) return
      const text = decoder.decode(new Uint8Array(buffers[stream]))
      buffers[stream] = []
      emit(stream, text, 'line')
    }
    const onByte = (stream: 'out' | 'err') => (code: number) => {
      if (code === 13) {
        emit(stream, decoder.decode(new Uint8Array(buffers[stream])), 'progress')
        buffers[stream] = []
        lastWasCR[stream] = true
        return
      }
      if (code === 10) {
        // \r\n ends the progress line; a plain \n ends an ordinary line
        if (lastWasCR[stream]) emit(stream, '', 'end')
        else emit(stream, decoder.decode(new Uint8Array(buffers[stream])), 'line')
        buffers[stream] = []
        lastWasCR[stream] = false
        return
      }
      buffers[stream].push(code)
      lastWasCR[stream] = false
    }
    try {
      const py = await getPyodide()
      py.setStdout({ raw: onByte('out') })
      py.setStderr({ raw: onByte('err') })
      py.setStdin({
        stdin: () => {
          sendPartial('out')
          sendPartial('err')
          post({ type: 'input-request', id: msg.id + '-' + ++inputs })
          return readLine(msg.id + '-' + inputs, msg.stdinPath)
        },
      })
      await py.runPythonAsync(msg.code)
      sendPartial('out')
      sendPartial('err')
      post({ type: 'done', id: msg.id, output: out.join('\n') })
    } catch (err) {
      sendPartial('out')
      sendPartial('err')
      post({
        type: 'done',
        id: msg.id,
        output: out.join('\n'),
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
})