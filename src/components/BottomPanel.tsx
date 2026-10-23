import { useEffect, useState } from 'react'
import { AlertTriangle, Info, Square, Trash2, X, XCircle } from 'lucide-react'
import { useBottomPanel, type BottomTab } from '../lib/panel/bottom'
import { outputStore } from '../lib/run/outputStore'
import { stopRun } from '../lib/run/runActive'
import { openAndReveal } from '../lib/editor/reveal'
import { notify } from '../lib/notify/store'
import { errorText } from '../lib/errors'
import { OutputBody } from './OutputPanel'
import { cn } from '../lib/utils'

interface Problem {
  path: string
  line: number
  column: number
  severity: number
  message: string
}

type MonacoMarker = {
  resource?: { path: string }
  startLineNumber: number
  startColumn: number
  severity: number
  message: string
}

// Monaco's errors and warnings for open files, refreshed every second
function useProblems(): Problem[] {
  const [list, setList] = useState<Problem[]>([])
  useEffect(() => {
    const read = () => {
      const monaco = (window as unknown as { monaco?: { editor: { getModelMarkers: (f: object) => MonacoMarker[] } } }).monaco
      if (!monaco) {
        setList([])
        return
      }
      setList(
        monaco.editor.getModelMarkers({}).map((m) => ({
          path: (m.resource?.path ?? '').replace(/^\//, ''),
          line: m.startLineNumber,
          column: m.startColumn,
          severity: m.severity,
          message: m.message,
        }))
      )
    }
    read()
    const id = window.setInterval(read, 1000)
    return () => window.clearInterval(id)
  }, [])
  return list
}

const TABS: { id: BottomTab; label: string }[] = [
  { id: 'problems', label: 'Problems' },
  { id: 'output', label: 'Output' },
  { id: 'debug', label: 'Debug Console' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'ports', label: 'Ports' },
]

const PLACEHOLDERS: Partial<Record<BottomTab, string>> = {
  debug: 'The debugger is not available yet.',
  terminal: 'A real terminal needs the Spectrum desktop app. It is coming in a later phase.',
  ports: 'No ports are open. Local servers will appear here in the desktop app.',
}

// Problems: click one to jump to its line
function ProblemsList({ problems }: { problems: Problem[] }) {
  if (problems.length === 0) {
    return <p className="px-3 py-2 text-xs text-[#938a7c]">No problems have been detected in the workspace.</p>
  }
  return (
    <ul className="py-1">
      {problems.map((p, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() =>
              void openAndReveal(p.path, p.line, p.column).catch((err) =>
                notify('Could not open ' + p.path + ': ' + errorText(err))
              )
            }
            className="w-full flex items-start gap-2 px-3 py-1 text-left text-xs hover:bg-[#2a261f]"
          >
            {p.severity === 8 ? (
              <XCircle size={12} className="mt-0.5 shrink-0 text-[#f85149]" />
            ) : p.severity === 4 ? (
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-[#d29922]" />
            ) : (
              <Info size={12} className="mt-0.5 shrink-0 text-[#938a7c]" />
            )}
            <span className="flex-1 text-[#f0a93b]">{p.message}</span>
            <span className="shrink-0 text-[#938a7c]">
              {p.path.split('/').pop()}:{p.line}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// The bottom panel: tabs for problems, output, and placeholders for features still to come
export function BottomPanel() {
  const open = useBottomPanel((s) => s.open)
  const tab = useBottomPanel((s) => s.tab)
  const show = useBottomPanel((s) => s.show)
  const close = useBottomPanel((s) => s.close)
  const outputOpen = outputStore((s) => s.open)
  const runStatus = outputStore((s) => s.status)
  const problems = useProblems()

  // A run opens the Output tab
  useEffect(() => {
    if (outputOpen) show('output')
  }, [outputOpen, show])


  const closePanel = () => {
    close()
    outputStore.getState().close()
  }

  const bar = 'p-1 rounded text-[#938a7c] hover:text-white hover:bg-[#2a261f]'

  return (
    <div
      className="shrink-0 overflow-clip"
      style={{ height: open ? 224 : 0, transition: 'height 180ms cubic-bezier(0.2, 0.7, 0.2, 1)' }}
    >
    <section className="h-56 shrink-0 flex flex-col min-h-0 border-t border-[#2d2921] bg-[#1a1814]">
      <div className="flex items-center justify-between h-8 px-2 border-b border-[#2d2921] bg-[#1a1814] select-none">
        <div className="flex items-center gap-1 min-w-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => show(t.id)}
              className={cn(
                'px-2 h-8 text-[11px] uppercase tracking-wide border-b-2 whitespace-nowrap',
                tab === t.id
                  ? 'text-[#f0a93b] border-[#f0a93b]'
                  : 'text-[#938a7c] border-transparent hover:text-[#f0a93b]'
              )}
            >
              {t.label}
              {t.id === 'problems' && problems.length > 0 && (
                <span className="ml-1 text-[10px] text-[#938a7c]">{problems.length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {tab === 'output' && (
            <>
              {runStatus === 'running' && (
                <button type="button" onClick={stopRun} title="Stop" className={bar}>
                  <Square size={12} />
                </button>
              )}
              <button type="button" onClick={() => outputStore.getState().clear()} title="Clear" className={bar}>
                <Trash2 size={12} />
              </button>
            </>
          )}
          <button type="button" onClick={closePanel} title="Close panel" className={bar}>
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {tab === 'problems' && (
          <div className="absolute inset-0 overflow-auto">
            <ProblemsList problems={problems} />
          </div>
        )}
        {tab === 'output' && <OutputBody />}
        {PLACEHOLDERS[tab] && (
          <p className="absolute inset-0 px-3 py-2 text-xs text-[#938a7c]">{PLACEHOLDERS[tab]}</p>
        )}
      </div>
    </section>
    </div>
  )
}