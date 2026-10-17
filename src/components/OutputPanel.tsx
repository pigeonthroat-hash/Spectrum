import { useEffect, useState } from 'react'
import { X, Square, Trash2 } from 'lucide-react'
import { outputStore } from '../lib/run/outputStore'
import { stopRun } from '../lib/run/runActive'
import { answerInput } from '../lib/python/pyRunner'

const PANEL_HEIGHT = 224 // pixels
const SLIDE_MS = 200

// The same font and size as the code editor
const EDITOR_FONT = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace"

// Terminal colours: normal text, red for errors, muted grey for notes
const LINE_CLASS: Record<string, string> = {
  command: 'text-[#cccccc]',
  log: 'text-[#cccccc]',
  prompt: 'text-[#cccccc]',
  error: 'text-[#f48771]',
  info: 'text-[#8b949e]',
}

// The line the user types into when the program calls input()
function InputLine({ id, inline = false }: { id: string; inline?: boolean }) {
  const [value, setValue] = useState('')
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') answerInput(id, value)
      }}
      className={
        inline
          ? "inline-block w-[16ch] align-baseline bg-transparent outline-none text-[#cccccc] caret-white"
          : "w-full bg-transparent outline-none text-[#cccccc] caret-white"
      }
      style={{ fontFamily: EDITOR_FONT, fontSize: 13 }}
      aria-label="Type your answer and press Enter"
    />
  )
}

// Output panel at the bottom of the editor: run output, typed input, or an HTML preview.
// It slides up when it opens and slides down when it closes.
export function OutputPanel() {
  const { open, title, status, exitCode, lines, preview, input } = outputStore()
  const [shown, setShown] = useState(false)

  // Each time the panel opens, start at zero height and grow on the next frame so the slide is visible
  useEffect(() => {
    if (!open) return
    setShown(false)
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [open])

  if (!open) return null

  const close = () => {
    setShown(false)
    window.setTimeout(() => outputStore.getState().close(), SLIDE_MS)
  }

  const statusText =
    preview !== null
      ? 'Preview'
      : input !== null
        ? 'Waiting for input...'
        : status === 'running'
          ? 'Running...'
          : status === 'done'
            ? 'Done (exit ' + exitCode + ')'
            : status === 'error'
              ? 'Error (exit ' + exitCode + ')'
              : status === 'stopped'
                ? 'Stopped'
                : ''

  const button =
    'flex items-center gap-1 px-2 py-0.5 rounded border border-[#30363d] bg-[#21262d] text-[#e6edf3] hover:bg-[#30363d]'

  return (
    <div
      className="shrink-0 overflow-hidden ease-out"
      style={{ height: shown ? PANEL_HEIGHT : 0, transition: `height ${SLIDE_MS}ms ease-out` }}
    >
      <div className="h-56 flex flex-col border-t border-[#30363d] bg-[#0d1117]">
        <div className="flex items-center gap-3 px-3 py-1 bg-[#161b22] border-b border-[#30363d] text-xs">
          <span className="text-[#e6edf3]">Output: {title}</span>
          <span className="text-[#8b949e]">{statusText}</span>
          <div className="ml-auto flex items-center gap-1.5">
            {status === 'running' && preview === null && (
              <button type="button" onClick={stopRun} className={button}>
                <Square size={11} /> Stop
              </button>
            )}
            {preview === null && (
              <button type="button" onClick={() => outputStore.getState().clear()} className={button}>
                <Trash2 size={11} /> Clear
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="p-0.5 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d]"
              title="Close"
            >
              <X size={13} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 relative">
          {preview !== null ? (
            <iframe
              title="Preview"
              sandbox="allow-scripts"
              srcDoc={preview}
              className="absolute inset-0 w-full h-full bg-white border-0"
            />
          ) : (
            <div
              className="absolute inset-0 overflow-auto px-3 py-2 text-[13px] leading-[19px] whitespace-pre-wrap bg-[#1e1e1e]"
              style={{ fontFamily: EDITOR_FONT }}
            >
              {lines.map((l, i) => {
                // A prompt ends with a space. While the program waits, the typing box sits right after it.
                const lastLine = i === lines.length - 1
                const inlinePrompt = input !== null && lastLine && /\s$/.test(l.text)
                return (
                  <div key={i} className={LINE_CLASS[l.kind]}>
                    {l.text || ' '}
                    {inlinePrompt && <InputLine key={input} id={input} inline />}
                  </div>
                )
              })}
              {input !== null && !(lines.length > 0 && /\s$/.test(lines[lines.length - 1].text)) && (
                <InputLine key={input} id={input} />
              )}
              {lines.length === 0 && status !== 'running' && input === null && (
                <span className="text-[#8b949e]">No output.</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}