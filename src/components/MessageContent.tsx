import { useEffect, useRef, useState } from 'react'
import { Check, Copy, FilePlus } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { executeTool } from '../lib/agent/tools'
import { errorText } from '../lib/errors'

// Suggested file name for a code block, based on its language
function defaultFileName(lang: string): string {
  const ext: Record<string, string> = {
    javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', tsx: 'tsx', jsx: 'jsx',
    html: 'html', css: 'css', python: 'py', py: 'py', json: 'json', markdown: 'md', md: 'md',
  }
  return `example.${ext[lang.toLowerCase()] ?? 'txt'}`
}

type Part =
  | { kind: 'text'; text: string; start: number }
  | { kind: 'code'; lang: string; code: string; start: number }

// Splits a reply into plain text and code blocks. An unfinished block (still streaming)
// is shown as code, so the box appears while the model is typing. Each part records where it starts in the reply.
function splitParts(text: string): Part[] {
  const parts: Part[] = []
  const re = /```([\w+.-]*)[^\n]*\n([\s\S]*?)```/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ kind: 'text', text: text.slice(last, m.index), start: last })
    parts.push({ kind: 'code', lang: m[1] || 'text', code: m[2].replace(/\n$/, ''), start: m.index })
    last = re.lastIndex
  }
  const rest = text.slice(last)
  const open = rest.indexOf('```')
  if (open >= 0) {
    if (open > 0) parts.push({ kind: 'text', text: rest.slice(0, open), start: last })
    const afterTicks = rest.slice(open + 3)
    const newline = afterTicks.indexOf('\n')
    const lang = newline >= 0 ? afterTicks.slice(0, newline).trim() : ''
    const code = newline >= 0 ? afterTicks.slice(newline + 1) : ''
    parts.push({ kind: 'code', lang: lang || 'text', code, start: last + open })
  } else if (rest) {
    parts.push({ kind: 'text', text: rest, start: last })
  }
  return parts
}

// A word fades in the first time it appears. The choice is made once, when the word mounts, and kept.
// Removing the fade class mid-animation would snap the word to full opacity, so later updates never touch it.
// `at` is where the word starts in the reply; `reveal` is how much of the reply was shown before this update.
function Word({ text, at, reveal }: { text: string; at: number; reveal: number }) {
  const [delay] = useState<number | null>(() => {
    if (at < reveal) return null
    // Later words in the same update wait a little longer, so they appear one after another
    return Math.min((at - reveal) / 6, 16) * 25
  })
  if (delay === null) return <span>{text}</span>
  return (
    <span className="word-in" style={{ animationDelay: `${delay}ms` }}>
      {text}
    </span>
  )
}

// Inline `code` becomes a monospace chip, and **bold** becomes bold
function InlineText({ text, base, reveal }: { text: string; base: number; reveal: number }) {
  const pieces = text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g)
  let offset = base
  return (
    <>
      {pieces.map((p, i) => {
        const at = offset
        offset += p.length
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
          return (
            <strong key={i} className="font-semibold text-white">
              <Word text={p.slice(2, -2)} at={at + 2} reveal={reveal} />
            </strong>
          )
        }
        if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
          return (
            <code key={i} className="px-1 py-0.5 rounded bg-[#21262d] text-[12px] font-mono text-[#e6edf3]">
              <Word text={p.slice(1, -1)} at={at + 1} reveal={reveal} />
            </code>
          )
        }
        let t = at
        return (
          <span key={i}>
            {p.split(/(\s+)/).map((tok, k) => {
              const here = t
              t += tok.length
              return tok.trim() ? (
                <Word key={k} text={tok} at={here} reveal={reveal} />
              ) : (
                <span key={k}>{tok}</span>
              )
            })}
          </span>
        )
      })}
    </>
  )
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const projectId = useAppStore((s) => s.projectId)

  // Saves the example as a new file. The new file waits for Apply or Decline, like any other new file.
  const saveAsNewFile = () => {
    if (!projectId) {
      window.alert('Open a project first, then save the example as a new file.')
      return
    }
    const name = window.prompt('New file name (for example src/example.js):', defaultFileName(lang))
    if (!name || !name.trim()) return
    executeTool(projectId, 'create_file', { path: name.trim(), content: code }).catch((err) =>
      window.alert(errorText(err))
    )
  }

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(t)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      // Clipboard can be blocked; nothing else to do
    }
  }

  return (
    <div className="rounded border border-[#30363d] bg-[#0d1117] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-2 py-0.5 bg-[#161b22] border-b border-[#30363d] text-[11px] text-[#8b949e]">
        <span className="truncate font-mono">{lang}</span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm hover:text-[#e6edf3] hover:bg-[#21262d]"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={saveAsNewFile}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm hover:text-[#e6edf3] hover:bg-[#21262d]"
          >
            <FilePlus size={11} />
            Save as new file
          </button>
        </div>
      </div>
      <pre className="p-2.5 overflow-x-auto text-[12px] leading-5 font-mono text-[#c9d1d9] whitespace-pre">{code}</pre>
    </div>
  )
}

// Renders an assistant reply: plain text with inline code, and code blocks with Copy and Apply buttons.
// While the reply streams, new words fade in one after another.
export function MessageContent({ text, streaming = false }: { text: string; streaming?: boolean }) {
  // How much of the reply was on screen before this update. A reply that is already finished shows everything at once.
  const shownRef = useRef<number | null>(null)
  if (shownRef.current === null) shownRef.current = streaming ? 0 : text.length
  const reveal = shownRef.current
  useEffect(() => {
    shownRef.current = text.length
  })

  const parts = splitParts(text)
  return (
    <div className="space-y-3">
      {parts.map((p, i) => {
        if (p.kind !== 'text') return <CodeBlock key={i} lang={p.lang} code={p.code} />
        const body = p.text.trim()
        if (!body) return null
        const lead = p.text.length - p.text.trimStart().length
        return (
          <div key={i} className="whitespace-pre-wrap leading-7">
            <InlineText text={body} base={p.start + lead} reveal={reveal} />
          </div>
        )
      })}
    </div>
  )
}