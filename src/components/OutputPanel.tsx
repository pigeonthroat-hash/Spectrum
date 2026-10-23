import { useEffect, useRef } from 'react'
import { outputStore } from '../lib/run/outputStore'
import { answerInput } from '../lib/python/pyRunner'
import { cn } from '../lib/utils'

// The same font and size as the code editor
const EDITOR_FONT = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace"

// Terminal colours: normal text, red for errors, muted grey for notes
const LINE_CLASS: Record<string, string> = {
  command: 'text-[#cccccc]',
  log: 'text-[#cccccc]',
  prompt: 'text-[#cccccc]',
  error: 'text-[#f48771]',
  info: 'text-[#938a7c]',
}

// The typing line. It is editable text, so long answers wrap onto new lines like the rest of the output.
function InputLine({ id, inline = false }: { id: string; inline?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)

  // Focus the line with the caret at the end
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [])

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Type your answer and press Enter"
      spellCheck={false}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          answerInput(id, ref.current?.textContent ?? '')
        }
      }}
      onPaste={(e) => {
        // Paste as plain text only
        e.preventDefault()
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
      }}
      className={cn('outline-none caret-white text-[#cccccc] break-all', inline ? 'inline' : 'block min-h-[19px]')}
    />
  )
}

// The Output tab: run output, typed input, or an HTML preview. Stop and Clear are in the bottom panel's bar.
export function OutputBody() {
  const { status, lines, preview, input } = outputStore()

  if (preview !== null) {
    return (
      <iframe
        title="Preview"
        sandbox="allow-scripts"
        srcDoc={preview}
        className="absolute inset-0 w-full h-full bg-white border-0"
      />
    )
  }

  const endsWithPrompt = lines.length > 0 && /\s$/.test(lines[lines.length - 1].text)

  return (
    <div
      className="absolute inset-0 overflow-auto px-3 py-2 text-[13px] leading-[19px] whitespace-pre-wrap bg-[#201d18]"
      style={{ fontFamily: EDITOR_FONT }}
    >
      {lines.map((l, i) => {
        // A prompt ends with a space. While the program waits, the typing box sits right after it.
        const inlinePrompt = input !== null && i === lines.length - 1 && /\s$/.test(l.text)
        return (
          <div key={i} className={LINE_CLASS[l.kind]}>
            {l.text || ' '}
            {inlinePrompt && <InputLine key={input} id={input} inline />}
          </div>
        )
      })}
      {input !== null && !endsWithPrompt && <InputLine key={input} id={input} />}
      {lines.length === 0 && status !== 'running' && input === null && (
        <span className="text-[#938a7c]">No output.</span>
      )}
    </div>
  )
}