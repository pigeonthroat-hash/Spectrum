// Agent loop for Groq models, using Groq's native tool calling.
// Only Groq models use this path. Ollama and browser models keep the text-tag loop in runAgent.ts.
// Python is the main tool for file work: one run_python call can read, write, copy, zip and more.
import type { AgentMode } from '../../store/useAppStore'
import type { Block, ToolBlock } from './types'
import { executeTool, listPaths } from './tools'
import { loadMemory } from './memory'
import { toolSpecs, canonicalName } from '../tools/registry'
import { useToolToggles, isToolOn } from '../tools/toggles'
import { MODE_HINTS } from './protocol'
import { runPython, pythonRunStats } from '../python/pyRunner'
import { clearReadCache } from './readCache'
import { awaitRunApproval, startRunReply } from './runApproval'
import { noteGroqUsage } from '../providers/groqUsage'
import { useAppStore } from '../../store/useAppStore'
import { errorText } from '../errors'
import { GROQ_PROXY_URL, getSignedInToken } from '../providers/groqProxy'
import type { TurnMessage } from '../ai/stream'

const MAX_STEPS = 8 // model requests per reply
const MAX_RESULT_CHARS = 3000 // output of a non-Python tool, sent back to the model
const MAX_PYTHON_CHARS = 4000 // output of run_python, sent back to the model
const CONTEXT_BUDGET_CHARS = 10000 // total tool output kept in the conversation. Oldest results go first when over.
const MAX_HISTORY_TURNS = 4 // earlier messages sent with each reply
const MAX_HISTORY_CHARS = 1200 // per earlier message
const MAX_FILES_LISTED = 25 // file names in the prompt
const MIN_GAP_MS = 1500 // spacing between Groq requests, so bursts don't hit the per-minute limit
const DEFAULT_WAIT_S = 20

// Python code that changes files. Results of reads stay valid only until one of these runs.
const CHANGES_FILES = /(write_file|edit_file|create_file|copy_file|move_file|delete_file|make_folder|unzip|zip_files|write_bytes)/

type Setter = (update: (blocks: Block[]) => Block[]) => void

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

interface ApiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}



// "Continue" and similar messages have no task of their own: the task is the last real request in the chat
const CONTINUE = /^(continue|go on|keep going|carry on|next|ok|okay|yes|sure|go)[.!?\s]*$/i

function currentTask(userText: string): string | null {
  if (!CONTINUE.test(userText.trim())) return null
  const msgs = useAppStore.getState().messages
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (m.role !== 'user') continue
    const text = m.content.trim()
    if (text.length >= 12 && !CONTINUE.test(text)) return text.slice(0, 600)
  }
  return null
}

const REREAD_BLOCKED =
  'Blocked: this code only re-read files that were already read earlier in this reply. Their text is in the earlier results. Stop reading. Make the change now with edit_file or write_file, copying the find text from the earlier result.'

// Python runs in this reply that only re-read files (reset at the start of each reply)
let rereadRuns = 0

// True when this run only re-read files. The third such run in a reply is blocked, so the model must write.
function rereadBlocked(call: ToolCall): boolean {
  if (call.function.name !== 'run_python') return false
  const stats = pythonRunStats()
  const onlyRereads = stats.rereads > 0 && stats.newReads === 0 && !stats.changed
  if (!onlyRereads) return false
  rereadRuns++
  return rereadRuns > 2
}

// A reply that only re-read files it already had gets a nudge to write the change
function rereadNote(call: ToolCall): string {
  if (call.function.name !== 'run_python') return ''
  const stats = pythonRunStats()
  return stats.rereads > 0 && stats.newReads === 0 && !stats.changed
    ? '\n\nNote: everything this code read was already read earlier in this reply. Use the text you have and make the change now.'
    : ''
}

function buildSystemPrompt(opts: {
  mode: AgentMode
  memory: string[]
  files: string[]
  activeFileName: string | null
  task: string | null
}): string {
  const lines = [
    'You are Spectrum, a coding assistant inside a code editor.',
    'Mode: ' + MODE_HINTS[opts.mode],
    'Most messages need no tools. Answer greetings and simple questions normally.',
    'Use read_file or list_files for one file or a file list. Use run_python only when a task needs several files at once, copying, zipping, or code to run. One run_python call can do many things.',
    'The Python helpers below are already defined. Call them directly with await. Do NOT import them (no "from functions import ...").',
    'open() and os can read project files, but changes made that way do not change the project. To change a file, use write_file or edit_file.',
    'Python helpers (always use await):',
    '- read_files(["a.ts", "b.ts"]) returns a dict of {path: text}. Use this to read several files at once.',
    '- read_file(path, start, end), list_files()',
    '- write_file(path, text): creates a new file, or proposes a full rewrite of an existing one',
    '- edit_file(path, find, replace): proposes an exact text change',
    '- copy_file(src, dst), move_file(src, dst), delete_file(path), make_folder(path)',
    '- zip_files(["a.ts", "b.ts"], "out.zip"), unzip("in.zip", "dest_folder")',
    'Example: files = await read_files(["src/a.ts", "src/b.ts"]); print(files["src/a.ts"][:500])',
    'Print only what you need: a function, a line range, or a summary. Do not print whole files you have already read. Output comes back in full (up to 6000 characters).',
    'Read the files you need in ONE run_python call. Then write the change in the next step. Do not read the same file again in this reply, even with different line numbers.',
    'You may make several tool calls in one reply. They run in order, and each one shows as its own step.',
    'Read each file once and use what you get back. Results stay in this conversation, so do not read a file again to see it.',
    'If the same call gives the same result, stop repeating it and use the result you have.',
    'To change an existing file, use edit_file (or write_file for a full rewrite). Edits are proposals: the user accepts or declines them unless auto-apply is on.',
    'Edit only the file the user is working on (Open file below), unless they name another file. Words in the request are not file names.',
    'Never invent file contents.',
    'After writing Python, run it and check the result. If it errors, fix it and run again. Do not repeat a failing call unchanged.',
    'After an edit, "proposed" means the user still has to accept it, so say so. "applied" means it is done.',
    'After every edit or Python change, read its result. If it shows an error or was not applied, fix it before going on. Never say a change was made unless the result says so.',
    'Before any tool call or Python run, write one short sentence saying what you are about to do.',
    'Use Python only when the task needs code to run: calculations, checking code, or many files at once. Do not run Python just to test or print nothing.',
    'To create a new file, use write_file or create_file directly, not Python.',
    'Keep replies short.',
    'If the user asks for something no tool can do yet, say which tool is not available. Do not answer from memory as if you had checked.',
  ]
  if (opts.memory.length) lines.push('', 'Notes from earlier chats:', ...opts.memory.slice(-10).map((n) => '- ' + n))
  if (opts.files.length) {
    lines.push('', 'Project files (first ' + MAX_FILES_LISTED + '):', ...opts.files.slice(0, MAX_FILES_LISTED))
    if (opts.files.length > MAX_FILES_LISTED) lines.push('...and more. Use list_files for the rest.')
  }
  if (opts.activeFileName) lines.push('', 'Open file: ' + opts.activeFileName)
  if (opts.task) lines.splice(2, 0, 'Current task (from earlier in this chat): ' + opts.task)
  return lines.join('\n')
}

function appendText(blocks: Block[], delta: string): Block[] {
  const last = blocks[blocks.length - 1]
  if (last && last.type === 'text') return [...blocks.slice(0, -1), { type: 'text', text: last.text + delta }]
  return [...blocks, { type: 'text', text: delta }]
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))
let lastCallAt = 0

// One request to Groq. Waits briefly between requests, and waits once and retries if Groq says it is busy.
async function callGroq(
  apiKey: string,
  model: string,
  messages: ApiMessage[],
  signal: AbortSignal | undefined,
  onText: (delta: string) => void,
  attempt = 0
): Promise<{ content?: string | null; tool_calls?: ToolCall[] }> {
  const gap = lastCallAt + MIN_GAP_MS - Date.now()
  if (gap > 0) await sleep(gap)
  lastCallAt = Date.now()

  const specs = toolSpecs(useToolToggles.getState().enabled)
  let res: Response
  try {
    res = await fetch(`${GROQ_PROXY_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        ...(specs.length > 0 ? { tools: specs, tool_choice: 'auto' } : {}),
        stream: true,
        parallel_tool_calls: true,
        max_tokens: 1500,
      }),
      signal,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new Error("Can't reach Groq. Check your internet connection.")
  }

  noteGroqUsage(res)
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    if (res.status === 429) {
      const seconds = Number(detail.match(/try again in ([\d.]+)s/i)?.[1] ?? DEFAULT_WAIT_S)
      if (attempt < 3 && seconds <= 60) {
        await sleep((seconds + 1) * 1000)
        return callGroq(apiKey, model, messages, signal, onText, attempt + 1)
      }
      throw new Error(
        `Groq's request limit is reached. Try again in about ${Math.ceil(seconds)} seconds, or pick another model.`
      )
    }
    if (res.status === 401) throw new Error('Groq rejected the API key. Check that it was copied correctly.')
    throw new Error(`Groq returned ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('Groq sent an empty reply.')
  const decoder = new TextDecoder()
  const content: string[] = []
  const calls = new Map<number, ToolCall>()
  type Delta = {
    choices?: {
      delta?: {
        content?: string | null
        tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[]
      }
    }[]
  }
  const handle = (line: string) => {
    if (!line.startsWith('data:')) return
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') return
    let chunk: Delta
    try {
      chunk = JSON.parse(data) as Delta
    } catch {
      return
    }
    const delta = chunk.choices?.[0]?.delta
    if (!delta) return
    if (delta.content) {
      content.push(delta.content)
      onText(delta.content)
    }
    for (const tc of delta.tool_calls ?? []) {
      const call = calls.get(tc.index) ?? { id: '', type: 'function' as const, function: { name: '', arguments: '' } }
      if (tc.id) call.id = tc.id
      if (tc.function?.name) call.function.name += tc.function.name
      if (tc.function?.arguments) call.function.arguments += tc.function.arguments
      calls.set(tc.index, call)
    }
  }
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    lines.forEach(handle)
  }
  handle(buffer)
  return {
    content: content.join(''),
    tool_calls: [...calls.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]),
  }
}

// Keeps the results of the latest step in full. Older results are dropped, oldest first,
// only when the conversation goes over the budget. Nothing is shortened silently.
function fitBudget(convo: ApiMessage[]): ApiMessage[] {
  let latest = -1
  convo.forEach((m, i) => {
    if (m.role === 'assistant' && m.tool_calls?.length) latest = i
  })
  const out = convo.map((m) => ({ ...m }))
  let total = out.reduce((n, m) => n + (m.role === 'tool' ? (m.content ?? '').length : 0), 0)
  const REMOVED = '[Older result removed to save space. Run the call again if you need it.]'
  for (let i = 0; i < out.length && total > CONTEXT_BUDGET_CHARS; i++) {
    const m = out[i]
    if (m.role !== 'tool' || i >= latest) continue
    total -= (m.content ?? '').length
    m.content = REMOVED
    total += REMOVED.length
  }
  return out
}

async function runOneTool(
  call: ToolCall,
  projectId: string | null,
  setBlocks: Setter
): Promise<{ block: ToolBlock; output: string; ok: boolean }> {
  // Tools turned off in the @ menu are refused, even if the model asks for them
  if (!isToolOn(canonicalName(call.function.name))) {
    return {
      block: { type: 'tool', id: call.id, kind: 'tool', name: call.function.name, input: call.function.arguments, status: 'error' },
      output: call.function.name + ' is turned off. The user can turn it on with the @ menu.',
      ok: false,
    }
  }
  let args: Record<string, unknown> = {}
  try {
    args = call.function.arguments ? (JSON.parse(call.function.arguments) as Record<string, unknown>) : {}
  } catch {
    return {
      block: { type: 'tool', id: call.id, kind: 'tool', name: call.function.name, input: call.function.arguments, status: 'error' },
      output: 'Error: the tool arguments were not valid JSON.',
      ok: false,
    }
  }

  if (call.function.name === 'run_python') {
    const code = String(args.code ?? '')
    const block: ToolBlock = { type: 'tool', id: call.id, kind: 'python', name: 'python', input: code, status: 'running' }
    setBlocks((bs) => [...bs, block])
    const decision = await awaitRunApproval(call.id, () =>
      setBlocks((bs) => bs.map((b) => (b.type === 'tool' && b.id === block.id ? { ...b, status: 'awaiting' as const } : b)))
    )
    if (decision !== 'run') {
      const output = decision === 'decline' ? 'The user declined to run this code.' : 'The run was cancelled.'
      return { block, output, ok: false }
    }
    setBlocks((bs) => bs.map((b) => (b.type === 'tool' && b.id === block.id ? { ...b, status: 'running' as const } : b)))
    try {
      // streamToPanel: the output panel shows the run, and typed input goes to the program
      const r = await runPython(projectId, code, undefined, true)
      const output = [r.output.trim(), r.error ?? ''].filter(Boolean).join('\n') || '(no output)'
      return { block, output, ok: !r.error }
    } catch (err) {
      return { block, output: 'Error: ' + errorText(err), ok: false }
    }
  }

  const block: ToolBlock = {
    type: 'tool',
    id: call.id,
    kind: 'tool',
    name: call.function.name,
    input: JSON.stringify(args),
    status: 'running',
  }
  setBlocks((bs) => [...bs, block])
  try {
    return { block, output: await executeTool(projectId, call.function.name, args), ok: true }
  } catch (err) {
    return { block, output: 'Error: ' + errorText(err), ok: false }
  }
}

// The code of a run_python call, or '' if the arguments are not valid
function codeOf(call: ToolCall): string {
  try {
    return String((JSON.parse(call.function.arguments || '{}') as { code?: unknown }).code ?? '')
  } catch {
    return ''
  }
}

// Two calls are the same if they do the same thing. Line ranges are part of a read, so different ranges are different reads.
function callKey(call: ToolCall): string {
  let args: Record<string, unknown> = {}
  try {
    args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
  } catch {
    // Bad arguments are handled when the tool runs
  }
  switch (call.function.name) {
    case 'read_file':
      return `read:${String(args.path ?? '')}:${String(args.start ?? '')}:${String(args.end ?? '')}`
    case 'list_files':
      return 'list'
    case 'search_files':
      return 'search:' + String(args.query ?? '')
    case 'run_python':
      return 'python:' + String(args.code ?? '')
    default:
      return call.function.name + ':' + call.function.arguments
  }
}

export async function runGroqAgent(opts: {
  projectId: string | null
  modelId: string
  mode: AgentMode
  history: TurnMessage[]
  userText: string
  activeFileName: string | null
  setBlocks: Setter
  signal?: AbortSignal
}): Promise<void> {
  const { projectId, setBlocks, signal } = opts
  if (signal?.aborted) return
  clearReadCache()
  rereadRuns = 0
  startRunReply()

  // Streamed text is shown in small batches, about 12 times a second
  let pendingText = ''
  let flushTimer: number | null = null
  const flushText = () => {
    flushTimer = null
    if (!pendingText) return
    const delta = pendingText
    pendingText = ''
    setBlocks((bs) => appendText(bs, delta))
  }
  const onText = (delta: string) => {
    pendingText += delta
    if (flushTimer === null) flushTimer = window.setTimeout(flushText, 80)
  }
  const flushNow = () => {
    if (flushTimer !== null) window.clearTimeout(flushTimer)
    flushTimer = null
    flushText()
  }

  const apiKey = await getSignedInToken()
  const model = opts.modelId.slice('groq/'.length)

  const memory = projectId ? loadMemory(projectId) : []
  const files = projectId ? await listPaths(projectId).catch(() => [] as string[]) : []

  const history: ApiMessage[] = opts.history
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: (m.content ?? '').slice(0, MAX_HISTORY_CHARS) }))

  const convo: ApiMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt({
        mode: opts.mode,
        memory,
        files,
        activeFileName: opts.activeFileName,
        task: currentTask(opts.userText),
      }),
    },
    ...history,
    { role: 'user', content: opts.userText },
  ]

  // Full results of successful calls in this reply. A repeated call gets the saved result again.
  const results = new Map<string, string>()
  let repeatOnlySteps = 0

  for (let step = 0; step < MAX_STEPS; step++) {
    if (signal?.aborted) return

    let reply: { content?: string | null; tool_calls?: ToolCall[] }
    try {
      reply = await callGroq(apiKey, model, fitBudget(convo), signal, onText)
    } catch (err) {
      flushNow()
      if (signal?.aborted) return
      throw err
    }
    flushNow()
    const toolCalls = reply.tool_calls ?? []
    if (toolCalls.length === 0) return

    convo.push({ role: 'assistant', content: reply.content || null, tool_calls: toolCalls })

    let fresh = 0
    for (const call of toolCalls) {
      if (signal?.aborted) return

      const key = callKey(call)
      const saved = results.get(key)
      if (saved !== undefined) {
        // Same call again: show the saved result, so the model can see what it already learned
        const block: ToolBlock = {
          type: 'tool',
          id: call.id,
          kind: call.function.name === 'run_python' ? 'python' : 'tool',
          name: call.function.name === 'run_python' ? 'python' : call.function.name,
          input: call.function.arguments,
          output: saved,
          status: 'done',
        }
        setBlocks((bs) => [...bs, block])
        convo.push({ role: 'tool', tool_call_id: call.id, content: 'Same result as before:\n' + saved })
        continue
      }
      fresh++

      const ran = await runOneTool(call, projectId, setBlocks)
      const block = ran.block
      const blocked = rereadBlocked(call)
      const output = blocked ? REREAD_BLOCKED : ran.output
      const ok = blocked ? false : ran.ok
      setBlocks((bs) => (bs.some((b) => b.type === 'tool' && b.id === block.id) ? bs : [...bs, block]))
      const finished = { ...block, output, status: ok ? ('done' as const) : ('error' as const) }
      setBlocks((bs) => bs.map((b) => (b.type === 'tool' && b.id === block.id ? finished : b)))

      const cap = call.function.name === 'run_python' ? MAX_PYTHON_CHARS : MAX_RESULT_CHARS
      convo.push({ role: 'tool', tool_call_id: call.id, content: (output + rereadNote(call)).slice(0, cap) })

      if (ok) results.set(key, output.slice(0, cap))

      // A change to files makes saved reads out of date
      const changes =
        call.function.name === 'edit_file' ||
        call.function.name === 'create_file' ||
        (call.function.name === 'run_python' && CHANGES_FILES.test(codeOf(call)))
      if (changes) {
        results.clear()
        clearReadCache()
      }
    }

    // A step with only repeated calls is going round in circles. One such step gets a reminder (already in the
    // conversation as "Same result as before"); two in a row means stop, instead of spending more requests.
    if (fresh === 0) {
      repeatOnlySteps++
      if (repeatOnlySteps >= 2) {
        setBlocks((bs) =>
          appendText(
            bs,
            '\n\nI kept repeating the same steps without making progress, so I stopped. Tell me the next change you want, or name the file to edit.'
          )
        )
        return
      }
    } else {
      repeatOnlySteps = 0
    }
  }

  setBlocks((bs) => appendText(bs, '\n\nStopped after ' + MAX_STEPS + ' steps to save requests. Send a message to continue.'))
}