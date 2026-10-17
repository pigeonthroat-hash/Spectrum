import { useAppStore } from '../../store/useAppStore'
import { runPython, cancelPython } from '../python/pyRunner'
import { storageFor } from '../storage/active'
import { languageLabel } from '../languages'
import { listPaths } from '../agent/tools'
import { outputStore, PROMPT, type RunStatus } from './outputStore'
import { openHtmlInNewTab } from './newTab'

const JS_TIMEOUT_MS = 300000 // 5 minutes; Stop works at any time

// The Stop button for the run in progress
let stopCurrent: (() => void) | null = null

export function stopRun(): void {
  const stop = stopCurrent
  stopCurrent = null
  if (stop) stop()
}

// Runs in a separate worker, so the page stays responsive and the code cannot touch the editor
const WORKER_SOURCE = `
const fmt = (v) => {
  if (typeof v === 'string') return v;
  const s = JSON.stringify(v);
  return s === undefined ? String(v) : s;
};
const send = (type, args) => postMessage({ type, text: args.map(fmt).join(' ') });
console.log = (...a) => send('out', a);
console.info = (...a) => send('out', a);
console.warn = (...a) => send('err', a);
console.error = (...a) => send('err', a);
self.onmessage = async (e) => {
  try {
    const run = new Function('return (async () => {\\n' + e.data.code + '\\n})()');
    await run();
    postMessage({ type: 'done' });
  } catch (err) {
    postMessage({ type: 'fail', text: String((err && err.message) || err) });
  }
};
`

async function runScript(code: string, language: 'javascript' | 'typescript'): Promise<void> {
  let js = code
  if (language === 'typescript') {
    const ts = await import('typescript')
    js = ts.transpileModule(code, {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
    }).outputText
  }

  const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }))
  const worker = new Worker(url)
  let finished = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const finish = (status: RunStatus, exitCode: number | null) => {
    if (finished) return
    finished = true
    if (timer) clearTimeout(timer)
    worker.terminate()
    URL.revokeObjectURL(url)
    stopCurrent = null
    outputStore.getState().finish(status, exitCode)
  }

  stopCurrent = () => finish('stopped', null)
  timer = setTimeout(() => {
    outputStore.getState().append('error', 'Stopped: the program took longer than 5 minutes.')
    finish('error', 1)
  }, JS_TIMEOUT_MS)

  worker.onmessage = (e: MessageEvent<{ type: string; text?: string }>) => {
    const m = e.data
    if (m.type === 'out') outputStore.getState().append('log', m.text ?? '')
    else if (m.type === 'err') outputStore.getState().append('error', m.text ?? '')
    else if (m.type === 'fail') {
      outputStore.getState().append('error', m.text ?? 'Error')
      finish('error', 1)
    } else if (m.type === 'done') finish('done', 0)
  }
  worker.onerror = (e) => {
    outputStore.getState().append('error', e.message || 'Worker error')
    finish('error', 1)
  }
  worker.postMessage({ code: js })
}

async function runPythonFile(code: string, projectId: string | null): Promise<void> {
  const out = outputStore.getState()
  if (!projectId) {
    out.append('error', 'Open a project first.')
    out.finish('error', 1)
    return
  }

  // Output and typed input go to the panel as they happen
  stopCurrent = () => cancelPython()
  const result = await runPython(projectId, code, undefined, true)
  stopCurrent = null
  if (result.error === 'Stopped.') {
    out.finish('stopped', null)
    return
  }

  // Printed output was already shown while the program ran; only the error is added here
  const error = result.error ? String(result.error) : ''
  for (const line of error ? error.split('\n') : []) out.append('error', line)
  if (error && /EOFError|\binput\(/.test(error)) {
    out.append('info', 'Hint: input() is not supported in this Python runner yet. Use variables instead.')
  }
  out.finish(error ? 'error' : 'done', error ? 1 : 0)
}

// Joins a relative path such as "js/../js/app.js" into a clean project path
function normalize(path: string): string {
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('/')
}

const isRemote = (ref: string) => /^(https?:)?\/\//i.test(ref) || ref.startsWith('data:')

// Builds a page from an HTML file by putting its linked CSS and JavaScript files inside it
async function buildPage(path: string, html: string, projectId: string): Promise<string> {
  const storage = storageFor(projectId)
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
  const resolve = (ref: string) => normalize(dir ? dir + '/' + ref : ref)
  const read = async (p: string): Promise<string | null> => {
    try {
      return await storage.readFile(p)
    } catch {
      return null
    }
  }

  let doc = html
  for (const m of [...html.matchAll(/<link\b[^>]*>/gi)]) {
    const tag = m[0]
    if (!/rel=["']stylesheet["']/i.test(tag)) continue
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1]
    if (!href || isRemote(href)) continue
    const css = await read(resolve(href))
    // A function replacement keeps "$" characters in the file from being read as special patterns
    doc = doc.replace(tag, () => (css === null ? '<!-- missing ' + href + ' -->' : '<style>\n' + css + '\n</style>'))
  }
  for (const m of [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi)]) {
    const tag = m[0]
    const src = m[1]
    if (isRemote(src)) continue
    const js = await read(resolve(src))
    doc = doc.replace(tag, () => (js === null ? '<!-- missing ' + src + ' -->' : '<script>\n' + js + '\n</script>'))
  }
  return doc
}

// Builds the page and opens it in a new tab
async function openPage(path: string, html: string, projectId: string | null): Promise<void> {
  const out = outputStore.getState()
  const title = path.split('/').pop() ?? path
  if (!projectId) {
    out.append('error', 'Open a project first.')
    out.finish('error', 1)
    return
  }
  const doc = await buildPage(path, html, projectId)
  if (openHtmlInNewTab(doc, title)) {
    out.append('info', 'Opened ' + title + ' in a new tab.')
    out.finish('done', 0)
  } else {
    out.append('error', 'The browser blocked the new tab. Allow pop-ups for this site, then try again.')
    out.finish('error', 1)
  }
}

// The Play button and the right-click "Run File" both call this
export async function runActiveFile(): Promise<void> {
  const state = useAppStore.getState()
  const tab = state.openTabs.find((t) => t.path === state.activeTabPath)
  if (!tab) return
  stopRun()
  const out = outputStore.getState()

  switch (tab.language) {
    case 'html':
      out.start(tab.name)
      out.append('command', PROMPT + 'open ' + tab.name)
      return openPage(tab.path, tab.content, state.projectId)
    case 'python':
      out.start(tab.name)
      out.append('command', PROMPT + 'python ' + tab.name)
      return runPythonFile(tab.content, state.projectId)
    case 'javascript':
    case 'typescript':
      out.start(tab.name)
      out.append('command', PROMPT + (tab.language === 'typescript' ? 'node (TypeScript) ' : 'node ') + tab.name)
      return runScript(tab.content, tab.language)
    default:
      out.start(tab.name)
      out.append('info', 'Running ' + languageLabel(tab.language) + ' files is not supported yet.')
      out.finish('error', 1)
  }
}

// Right-click a folder, then "Run Project": opens that folder's index.html in a new tab
export async function runProject(folder: string): Promise<void> {
  const projectId = useAppStore.getState().projectId
  if (!projectId) return
  stopRun()
  const out = outputStore.getState()
  const label = folder || 'project'
  const indexPath = folder ? folder + '/index.html' : 'index.html'

  out.start(label)
  out.append('command', PROMPT + 'run ' + label)
  const paths = await listPaths(projectId)
  if (!paths.includes(indexPath)) {
    out.append('error', 'No index.html found' + (folder ? ' in ' + folder : ' in the project') + '.')
    out.finish('error', 1)
    return
  }
  const html = await storageFor(projectId).readFile(indexPath)
  await openPage(indexPath, html, projectId)
}