// Agent loop for Groq models, using Groq's native tool calling.
// Only Groq models use this path. Ollama and browser models keep the text-tag loop in runAgent.ts.
import type { AgentMode } from '../../store/useAppStore'
import type { Block, ToolBlock } from './types'
import { executeTool, listPaths } from './tools'
import { loadMemory } from './memory'
import { MODE_HINTS } from './protocol'
import { runPython } from '../python/pyRunner'
import { errorText } from '../errors'
import { GROQ_PROXY_URL, getSignedInToken } from '../providers/groqProxy'
import type { TurnMessage } from '../ai/stream'

const MAX_STEPS = 8
const MAX_RESULT_CHARS = 4000

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

const str = (description: string) => ({ type: 'string', description })

const TOOL_SPECS = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List all project file paths.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a project file, or a range of lines.',
      parameters: {
        type: 'object',
        properties: {
          path: str('File path, e.g. src/App.tsx'),
          start: { type: 'integer', description: 'First line (optional, 1-based)' },
          end: { type: 'integer', description: 'Last line (optional)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Find text in project files.',
      parameters: {
        type: 'object',
        properties: { query: str('Text to search for') },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_file',
      description: 'Create a NEW file. Existing files cannot be overwritten.',
      parameters: {
        type: 'object',
        properties: { path: str('New file path'), content: str('Full file content') },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description:
        'Propose a change to an existing file. Replaces the exact text in "find" with "replace". The user accepts or rejects it. "find" must match the file exactly once. Use an empty "find" only for an empty file; then "replace" becomes the whole file. After edit_file, follow the tool result. If it says proposed, say it is waiting for the user to apply it. If it says applied, say it is done and continue with the next step. Edit only the file the user is working on (Open file below), unless they name a different file. Words in the request are not a file name.',
      parameters: {
        type: 'object',
        properties: {
          path: str('File path'),
          find: str('Exact text to replace, copied from read_file, including spaces'),
          replace: str('New text'),
        },
        required: ['path', 'find', 'replace'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remember',
      description: 'Save a short note for future chats.',
      parameters: {
        type: 'object',
        properties: { note: str('The fact to remember') },
        required: ['note'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forget',
      description: 'Remove saved notes that contain this text.',
      parameters: {
        type: 'object',
        properties: { match: str('Text to match') },
        required: ['match'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_python',
      description: 'Run Python code and return its printed output. Use this for any calculation.',
      parameters: {
        type: 'object',
        properties: { code: str('Python code. Use print() to show results.') },
        required: ['code'],
      },
    },
  },
]

function buildGroqSystemPrompt(opts: {
  mode: AgentMode
  memory: string[]
  files: string[]
  activeFileName: string | null
}): string {
  const lines = [
  'You are Spectrum, a coding assistant inside a code editor.',
  `Mode: ${MODE_HINTS[opts.mode]}`,
  '',
  'Rules:',
  '- Use tools for any file access, code execution, or calculation. Never invent file contents or compute math yourself.',
  '- Always read a file before describing or editing it.',
  '- To edit an existing file: read → edit_file. The user reviews the change before it is applied.',
  '- Use create_file only for brand-new files.',
  '- If a tool errors, do not retry the same call. Re-read the file and use a shorter find string.',
  '- When asked to add or change content in a file, read it once, then use edit_file. Do not read the file again.',
  '- To add code to an existing file, use edit_file, not a code block. Code blocks are for examples only.',
  '- When finished, reply in plain text only.',
]
  if (opts.memory.length) lines.push('', 'Notes from earlier chats:', ...opts.memory.map((n) => `- ${n}`))
  if (opts.files.length) {
    lines.push('', 'Project files (first 60):', ...opts.files.slice(0, 60))
    if (opts.files.length > 60) lines.push(`...and ${opts.files.length - 60} more. Use list_files for the rest.`)
  }
  if (opts.activeFileName) lines.push('', `Open file: ${opts.activeFileName}`)
  return lines.join('\n')
}

function appendText(blocks: Block[], delta: string): Block[] {
  const last = blocks[blocks.length - 1]
  if (last && last.type === 'text') return [...blocks.slice(0, -1), { type: 'text', text: last.text + delta }]
  return [...blocks, { type: 'text', text: delta }]
}

async function callGroq(apiKey: string, model: string, messages: ApiMessage[], signal?: AbortSignal) {
  let res: Response
  try {
    res = await fetch(`${GROQ_PROXY_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, tools: TOOL_SPECS, tool_choice: 'auto', max_tokens: 2000 }),
      signal,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new Error("Can't reach Groq. Check your internet connection.")
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    if (res.status === 401) throw new Error('Groq rejected the API key. Check that it was copied correctly.')
    if (res.status === 429) throw new Error('Groq rate limit reached. Wait a minute, or pick another model.')
    throw new Error(`Groq returned ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`)
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[]
  }
  return json.choices?.[0]?.message ?? { content: null, tool_calls: [] }
}

async function runOneTool(
  call: ToolCall,
  projectId: string | null
): Promise<{ block: ToolBlock; output: string; ok: boolean }> {
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
    try {
      const r = await runPython(projectId, code)
      const output = [r.output.trim(), r.error ?? ''].filter(Boolean).join('\n') || '(no output)'
      return { block, output, ok: !r.error }
    } catch (err) {
      return { block, output: `Error: ${errorText(err)}`, ok: false }
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
  try {
    return { block, output: await executeTool(projectId, call.function.name, args), ok: true }
  } catch (err) {
    return { block, output: `Error: ${errorText(err)}`, ok: false }
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

  const apiKey = await getSignedInToken()
  const model = opts.modelId.slice('groq/'.length)

  const memory = projectId ? loadMemory(projectId) : []
  const files = projectId ? await listPaths(projectId).catch(() => [] as string[]) : []

  const convo: ApiMessage[] = [
    {
      role: 'system',
      content: buildGroqSystemPrompt({ mode: opts.mode, memory, files, activeFileName: opts.activeFileName }),
    },
    ...opts.history.map((m) => ({ role: m.role, content: m.content }) as ApiMessage),
    { role: 'user', content: opts.userText },
  ]

  const seen = new Set<string>()

  for (let step = 0; step < MAX_STEPS; step++) {
    if (signal?.aborted) return

    let reply: { content?: string | null; tool_calls?: ToolCall[] }
    try {
      reply = await callGroq(apiKey, model, convo, signal)
    } catch (err) {
      if (signal?.aborted) return
      throw err
    }
    const toolCalls = reply.tool_calls ?? []

    if (reply.content && reply.content.trim()) {
      setBlocks((bs) => appendText(bs, reply.content as string))
    }

    if (toolCalls.length === 0) return

    convo.push({ role: 'assistant', content: reply.content ?? null, tool_calls: toolCalls })

    for (const call of toolCalls) {
      if (signal?.aborted) return

      const key = `${call.function.name}:${call.function.arguments}`
      if (seen.has(key)) {
        convo.push({
          role: 'tool',
          tool_call_id: call.id,
          content: 'You already ran this exact call and have its result above. Do not repeat it. Make the change with edit_file, or give the answer.',
        })
        continue
      }
      seen.add(key)

      const { block, output, ok } = await runOneTool(call, projectId)
      setBlocks((bs) => [...bs, block])
      const finished = { ...block, output, status: ok ? ('done' as const) : ('error' as const) }
      setBlocks((bs) => bs.map((b) => (b.type === 'tool' && b.id === block.id ? finished : b)))
      convo.push({ role: 'tool', tool_call_id: call.id, content: output.slice(0, MAX_RESULT_CHARS) })

      // A file change makes earlier reads out of date, so they are allowed again
      if (call.function.name === 'edit_file' || call.function.name === 'create_file') seen.clear()
   }
  }
}