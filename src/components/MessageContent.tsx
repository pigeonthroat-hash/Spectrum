import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

type Part = { kind: 'text'; text: string } | { kind: 'code'; lang: string; code: string }

// Splits a reply into plain text and code blocks. An unfinished block (still streaming)
// is shown as code, so the box appears while the model is typing.
function splitParts(text: string): Part[] {
  const parts: Part[] = []
  const re = /```([\w+.-]*)[^\n]*\n([\s\S]*?)```/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ kind: 'text', text: text.slice(last, m.index) })
    parts.push({ kind: 'code', lang: m[1] || 'text', code: m[2].replace(/\n$/, '') })
    last = re.lastIndex
  }
  const rest = text.slice(last)
  const open = rest.indexOf('```')
  if (open >= 0) {
    if (open > 0) parts.push({ kind: 'text', text: rest.slice(0, open) })
    const afterTicks = rest.slice(open + 3)
    const newline = afterTicks.indexOf('\n')
    const lang = newline >= 0 ? afterTicks.slice(0, newline).trim() : ''
    const code = newline >= 0 ? afterTicks.slice(newline + 1) : ''
    parts.push({ kind: 'code', lang: lang || 'text', code })
  } else if (rest) {
    parts.push({ kind: 'text', text: rest })
  }
  return parts
}

// Inline `code` becomes a monospace chip, and **bold** becomes bold
function InlineText({ text }: { text: string }) {
  const pieces = text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g)
  return (
    <>
      {pieces.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
          return (
            <strong key={i} className="font-semibold text-white">
              {p.slice(2, -2)}
            </strong>
          )
        }
        if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
          return (
            <code key={i} className="px-1 py-0.5 rounded bg-[#21262d] text-[12px] font-mono text-[#e6edf3]">
              {p.slice(1, -1)}
            </code>
          )
        }
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false)

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
            disabled
            title="Apply comes with diff review (coming soon)"
            className="px-1.5 py-0.5 rounded-sm opacity-50 cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      </div>
      <pre className="p-2.5 overflow-x-auto text-[12px] leading-5 font-mono text-[#c9d1d9] whitespace-pre">{code}</pre>
    </div>
  )
}

// Renders an assistant reply: plain text with inline code, and code blocks with Copy and Apply buttons
export function MessageContent({ text }: { text: string }) {
  const parts = splitParts(text)
  return (
    <div className="space-y-2">
      {parts.map((p, i) =>
        p.kind === 'text' ? (
          p.text.trim() ? (
            <div key={i} className="whitespace-pre-wrap leading-relaxed">
              <InlineText text={p.text.trim()} />
            </div>
          ) : null
        ) : (
          <CodeBlock key={i} lang={p.lang} code={p.code} />
        )
      )}
    </div>
  )
}