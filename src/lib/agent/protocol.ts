import type { AgentMode } from '../../store/useAppStore'

export const MODE_HINTS: Record<AgentMode, string> = {
  agent: 'Help the user complete the task. Show the code changes you would make.',
  plan: 'Break the task into a short numbered plan before writing any code.',
  debug: 'Find the most likely root cause of the problem, explain why, then suggest a minimal fix.',
  ask: 'Answer the question clearly. Do not propose file edits.',
}

// Tells the model how to call tools and Python. Kept short to save tokens.
export function buildSystemPrompt(opts: {
  mode: AgentMode
  memory: string[]
  files: string[]
  activeFileName: string | null
}): string {
  const lines: string[] = [
    'You are Spectrum, a coding assistant inside a code editor. Be concise and practical.',
    `Mode: ${MODE_HINTS[opts.mode]}`,
    '',
    'TOOLS. To use a tool, reply with only this block, then stop:',
    '<tool>{"name":"list_files","args":{}}</tool>',
    'Available tools:',
    '- list_files: {} lists project file paths.',
    '- read_file: {"path":"src/a.ts","start":1,"end":120} reads lines. start and end are optional.',
    '- search_files: {"query":"text"} finds text in project files.',
    '- create_file: {"path":"src/new.ts","content":"..."} creates a new file.',
    '- remember: {"note":"short fact"} saves a note for future chats.',
    '- forget: {"match":"text"} removes notes that contain the text.',
    '',
    'PYTHON. To run Python, reply with only this block, then stop:',
    '<python>',
    'print(2 + 2)',
    '</python>',
    'Python can also use: await list_files(), await read_file(path, start, end), await create_file(path, content).',
    'Use print() to show results. Prefer Python to check math and code. If Python fails twice in a row, use the tools instead.',
    '',
    'After a tool or Python runs, the app replies with <result>...</result>. Then continue.',
    'When you have the answer, reply in plain text with no tags.',
  ]
  if (opts.memory.length) lines.push('', 'Notes from earlier chats:', ...opts.memory.map((n) => `- ${n}`))
  if (opts.files.length) {
    lines.push('', 'Project files:', ...opts.files.slice(0, 150))
    if (opts.files.length > 150) lines.push(`...and ${opts.files.length - 150} more`)
  }
  if (opts.activeFileName) lines.push('', `Open file: ${opts.activeFileName}`)
  return lines.join('\n')
}