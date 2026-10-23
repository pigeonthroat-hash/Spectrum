import type { PyodideInterface } from 'pyodide'

// Must match the installed pyodide version. Check it with: npm ls pyodide

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
import base64
import io
import zipfile

async def list_files():
    return json.loads(await spectrum_fs("list", "[]"))

async def read_file(path, start=None, end=None):
    if isinstance(path, dict):
        start = path.get("start", start)
        end = path.get("end", end)
        path = path["path"]
    return await spectrum_fs("read", json.dumps([path, start, end]))

async def create_file(path, content=""):
    return await spectrum_fs("create", json.dumps([path, content]))

async def read_files(paths):
    return json.loads(await spectrum_fs("read_many", json.dumps([paths])))

async def write_file(path, content="", text=None):
    if isinstance(path, dict):
        content = path.get("content", content)
        path = path["path"]
    if text is not None:
        content = text
    return await spectrum_fs("write", json.dumps([path, content]))

async def edit_file(path, find, replace):
    return await spectrum_fs("edit", json.dumps([path, find, replace]))

async def copy_file(src, dst):
    return await spectrum_fs("copy", json.dumps([src, dst]))

async def move_file(src, dst):
    return await spectrum_fs("move", json.dumps([src, dst]))

async def delete_file(path):
    return await spectrum_fs("delete", json.dumps([path]))

async def make_folder(path):
    return await spectrum_fs("mkdir", json.dumps([path]))

async def read_bytes(path):
    return base64.b64decode(await spectrum_fs("read_bytes", json.dumps([path])))

async def write_bytes(path, data):
    return await spectrum_fs("write_bytes", json.dumps([path, base64.b64encode(data).decode()]))

async def zip_files(paths, zip_path):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for p in paths:
            z.writestr(p, await read_bytes(p))
    await write_bytes(zip_path, buf.getvalue())
    return zip_path

async def unzip(zip_path, dest_folder=""):
    z = zipfile.ZipFile(io.BytesIO(await read_bytes(zip_path)))
    made = []
    for name in z.namelist():
        if name.endswith("/"):
            continue
        target = (dest_folder.rstrip("/") + "/" + name) if dest_folder else name
        await write_bytes(target, z.read(name))
        made.append(target)
    return made

import sys as _sys
import types as _types
_mod = _types.ModuleType("functions")
for _name in ["list_files", "read_file", "read_files", "write_file", "edit_file", "create_file",
              "copy_file", "move_file", "delete_file", "make_folder", "zip_files", "unzip",
              "read_bytes", "write_bytes"]:
    setattr(_mod, _name, globals()[_name])
_sys.modules["functions"] = _mod
_sys.modules["spectrum"] = _mod
`

// Copies the project's text files into Python's sandbox, so open() and os see them.
// Only used for runs that need files. Changes made with open() stay in the sandbox; use write_file to change the project.
const PROJECT_DIR = '/home/pyodide/project'
const MAX_MOUNT_FILES = 60
const MAX_MOUNT_CHARS = 200000

async function mountProject(py: PyodideInterface): Promise<void> {
  const all: string[] = JSON.parse(await fsCall('list', '[]'))
  const paths = all.slice(0, MAX_MOUNT_FILES)
  const texts: Record<string, string> = JSON.parse(await fsCall('read_many', JSON.stringify([paths])))
  py.FS.mkdirTree(PROJECT_DIR)
  for (const p of paths) {
    const text = texts[p]
    if (typeof text !== 'string' || text.startsWith('ERROR:') || text.length > MAX_MOUNT_CHARS) continue
    const full = `${PROJECT_DIR}/${p}`
    py.FS.mkdirTree(full.slice(0, full.lastIndexOf('/')))
    py.FS.writeFile(full, text)
  }
  await py.runPythonAsync(`import os\nos.chdir(${JSON.stringify(PROJECT_DIR)})`)
}

let pyodidePromise: Promise<PyodideInterface> | null = null

function getPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    post({ type: 'status', text: 'Loading Python (first time only)...' })
    pyodidePromise = (async () => {
      // The npm package for the pinned version, so the files match what package.json installs
      // Served from this site (copied in by scripts/copy-pyodide.mjs), not from a CDN
      const cdn = `${import.meta.env.BASE_URL}pyodide/`
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
          post({ type: 'input-request', id: msg.token + '-' + ++inputs })
          return readLine(msg.token + '-' + inputs, msg.stdinPath)
        },
      })
      if (/\bopen\s*\(|\bos\.|\bpathlib\b|\bglob\b/.test(msg.code)) await mountProject(py)
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