import type { AgentMode } from '../../store/useAppStore'
import type { Block, ToolBlock } from './types'
import { buildSystemPrompt } from './protocol'
import { executeTool, listPaths } from './tools'
import { loadMemory } from './memory'
import { streamModel, type TurnMessage } from '../ai/stream'
import { runPython } from '../python/pyRunner'
import { errorText } from '../errors'
import { awaitRunApproval, startRunReply } from './runApproval'
import { runGroqAgent } from './groqAgent'
import { useAppStore } from '../../store/useAppStore'

const MAX_STEPS = 8
const MAX_RESULT_CHARS = 4000
const STOP = ['</tool', '</python']
const FLUSH_MS = 80

type Setter = (update: (blocks: Block[]) => Block[]) => void

interface Call {
  kind: 'tool' | 'python'
  before: string
  body: string
  normalized: string
}

const TAGS = [
  { kind: 'tool' as const, open: '<tool>', close: '</tool>' },
  { kind: 'python' as const, open: '<python>', close: '</python>' },
]

function stripFences(code: string): string {
  let s = code.trim()
  if (s.startsWith('```')) s = s.slice(s.indexOf('\n') + 1)
  if (s.endsWith('```')) s = s.slice(0, -3)
  return s.trim()
}

// Finds the first tool or Python block in a reply
function findCall(text: string): Call | null {
  let best: { idx: number; kind: 'tool' | 'python'; open: string; close: string } | null = null
  for (const t of TAGS) {
    const idx = text.indexOf(t.open)
    if (idx >= 0 && (best === null || idx < best.idx)) best = { idx, ...t }
  }
  if (!best) return null
  const start = best.idx + best.open.length
  const end = text.indexOf(best.close, start)
  let raw: string
  if (end >= 0) {
    raw = text.slice(start, end)
  } else {
    // No full closing tag. Drop a partial one such as "</python" at the end.
    raw = text.slice(start).replace(/<\/?[a-z]*$/i, '')
  }
  raw = raw.trim()
  const body = best.kind === 'python' ? stripFences(raw) : raw
  return {
    kind: best.kind,
    before: text.slice(0, best.idx),
    body,
    normalized: text.slice(0, best.idx) + best.open + raw + best.close,
  }
}

function toolNameOf(body: string): string {
  try {
    const spec = JSON.parse(body) as { name?: unknown }
    return typeof spec.name === 'string' ? spec.name : 'unknown'
  } catch {
    return 'unknown'
  }
}

function appendText(blocks: Block[], delta: string): Block[] {
  const last = blocks[blocks.length - 1]
  if (last && last.type === 'text') return [...blocks.slice(0, -1), { type: 'text', text: last.text + delta }]
  return [...blocks, { type: 'text', text: delta }]
}

// Replaces the text block that held the tool tag with the text before the tag
function replaceTrailingText(blocks: Block[], before: string): Block[] {
  const out = [...blocks]
  const last = out[out.length - 1]
  if (last && last.type === 'text') out.pop()
  if (before.trim()) out.push({ type: 'text', text: before.replace(/\s+$/, '') })
  return out
}

async function runCall(
  call: Call,
  _projectId: string | null,
  id: string,
  setBlocks: Setter
): Promise<{ output: string; ok: boolean }> {
  if (call.kind === 'python') {
    const decision = await awaitRunApproval(id, () =>
      setBlocks((bs) => bs.map((b) => (b.type === 'tool' && b.id === id ? { ...b, status: 'awaiting' as const } : b)))
    )
    if (decision !== 'run') {
      return { output: decision === 'decline' ? 'The user declined to run this code.' : 'The run was cancelled.', ok: false }
    }
    setBlocks((bs) => bs.map((b) => (b.type === 'tool' && b.id === id ? { ...b, status: 'running' as const } : b)))
    const r = await runPython(useAppStore.getState().projectId, call.body, undefined, true)
    const output = [r.output.trim(), r.error ?? ''].filter(Boolean).join('\n')
    return { output: output || '(no output)', ok: !r.error }
  }
  let spec: { name?: unknown; args?: unknown }
  try {
    spec = JSON.parse(call.body)
  } catch {
    return { output: 'Error: the tool call was not valid JSON.', ok: false }
  }
  const name = typeof spec.name === 'string' ? spec.name : 'unknown'
  const args = (spec.args && typeof spec.args === 'object' ? spec.args : {}) as Record<string, unknown>
  try {
    return { output: await executeTool(useAppStore.getState().projectId, name, args), ok: true }
  } catch (err) {
    return { output: `Error: ${errorText(err)}`, ok: false }
  }
}

// Runs one user request: the model may call tools and Python several times before answering
export async function runAgent(opts: {
  projectId: string | null
  modelId: string
  mode: AgentMode
  history: TurnMessage[]
  userText: string
  activeFileName: string | null
  setBlocks: Setter
  signal?: AbortSignal
}): Promise<void> {
  // Groq models use native tool calling (see groqAgent.ts). Everything else uses the text-tag loop below.
  if (opts.modelId.startsWith('groq/')) return runGroqAgent(opts)
  startRunReply()

  const { projectId, setBlocks, signal } = opts
  if (signal?.aborted) return

  const memory = projectId ? loadMemory(projectId) : []
  const files = projectId ? await listPaths(projectId).catch(() => [] as string[]) : []

  const convo: TurnMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt({ mode: opts.mode, memory, files, activeFileName: opts.activeFileName, noWorkspace: !projectId }),
    },
    ...opts.history,
    { role: 'user', content: opts.userText },
  ]

  // Text streams in batches, so the screen updates about 12 times a second instead of once per word
  let pendingText = ''
  let timer: number | null = null
  const flush = () => {
    timer = null
    if (!pendingText) return
    const delta = pendingText
    pendingText = ''
    setBlocks((bs) => appendText(bs, delta))
  }
  const cancelFlush = () => {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    if (signal?.aborted) return

    let text = ''
    try {
      await streamModel({
        modelId: opts.modelId,
        messages: convo,
        stop: STOP,
        maxTokens: 900,
        signal,
        onToken: (t) => {
          text += t
          pendingText += t
          if (timer === null) timer = window.setTimeout(flush, FLUSH_MS)
        },
      })
    } catch (err) {
      // Stop pressed: keep what was written so far. Any other error goes up to the chat.
      if (signal?.aborted) {
        cancelFlush()
        flush()
        return
      }
      throw err
    }
    cancelFlush()
    flush()

    // Stop pressed while the model was writing: do not run any tool
    if (signal?.aborted) return

    const call = findCall(text)
    if (!call) return

    // The stop sequence cut off the closing tag, so put it back in the conversation
    convo.push({ role: 'assistant', content: call.normalized })

    const id = `${Date.now()}-${step}`
    const name = call.kind === 'python' ? 'python' : toolNameOf(call.body)
    const block: ToolBlock = { type: 'tool', id, kind: call.kind, name, input: call.body, status: 'running' }
    setBlocks((bs) => [...replaceTrailingText(bs, call.before), block])

    const result = await runCall(call, projectId, id, setBlocks)
    setBlocks((bs) =>
      bs.map((b) =>
        b.type === 'tool' && b.id === id ? { ...b, output: result.output, status: result.ok ? 'done' : 'error' } : b
      )
    )
    convo.push({ role: 'user', content: `<result>\n${result.output.slice(0, MAX_RESULT_CHARS)}\n</result>` })
  }

  setBlocks((bs) => appendText(bs, '\n\nStopped after 8 steps.'))
}