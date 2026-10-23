import { useState } from 'react'
import { Check, ChevronDown, Clock, Eye, FilePen, Loader2, Search, Terminal, X } from 'lucide-react'
import type { ToolBlock as ToolBlockData } from '../lib/agent/types'
import { TOOL_LABELS } from '../lib/agent/types'
import { answerRun } from '../lib/agent/runApproval'
import { applyPending, declinePending } from '../lib/agent/applyChange'
import { useAppStore } from '../store/useAppStore'
import { RunMenu } from './RunMenu'
import { cn } from '../lib/utils'

const EDIT_TOOLS = ['edit_file', 'str_replace', 'write_file', 'create_file']

// The file a tool row is about, from its arguments
function targetOf(block: ToolBlockData): string {
  if (block.kind === 'python') return ''
  try {
    const args = JSON.parse(block.input) as { path?: unknown }
    return typeof args.path === 'string' ? args.path : ''
  } catch {
    return ''
  }
}

const linesOf = (text: unknown) => (typeof text === 'string' && text.length > 0 ? text.split('\n').length : 0)

// +added -removed for an edit, or +lines for a new file
function countsOf(block: ToolBlockData): { plus: number; minus: number } {
  try {
    const args = JSON.parse(block.input) as { find?: unknown; replace?: unknown; content?: unknown }
    if (block.name === 'edit_file' || block.name === 'str_replace') {
      return { plus: linesOf(args.replace), minus: linesOf(args.find) }
    }
    return { plus: linesOf(args.content), minus: 0 }
  } catch {
    return { plus: 0, minus: 0 }
  }
}

const basename = (path: string) => path.split('/').pop() ?? path

// A file edit is a card with Apply and Decline. Every other tool is a plain row, like Cursor's.
export function ToolBlock({ block }: { block: ToolBlockData }) {
  const [open, setOpen] = useState(false)
  const pendingDiffs = useAppStore((s) => s.pendingDiffs)
  const waiting = block.status === 'awaiting'
  const running = block.status === 'running'
  const failed = block.status === 'error'
  const path = targetOf(block)

  if (EDIT_TOOLS.includes(block.name)) {
    const pending = pendingDiffs.some((d) => d.path === path)
    const { plus, minus } = countsOf(block)
    return (
      <div className="rounded-md border border-[#2a261f] bg-[#15130f] text-xs">
        <div className="flex items-center gap-2 px-2.5 py-1.5">
          <FilePen size={12} className="text-[#938a7c] shrink-0" />
          <span className="truncate text-[#f0a93b]">{path || block.name}</span>
          <span className="text-[#3fb950] shrink-0">+{plus}</span>
          <span className="text-[#f85149] shrink-0">-{minus}</span>
          {pending ? (
            <span className="ml-auto flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => declinePending(path)}
                title="Decline"
                className="p-1 rounded text-[#938a7c] hover:text-[#f85149] hover:bg-[#2a261f]"
              >
                <X size={12} />
              </button>
              <button
                type="button"
                onClick={() => void applyPending(path)}
                title="Apply"
                className="p-1 rounded text-[#938a7c] hover:text-[#f0a93b] hover:bg-[#2a261f]"
              >
                <Check size={12} />
              </button>
            </span>
          ) : (
            <span className="ml-auto text-[10px] text-[#6f675a] shrink-0">
              {failed ? 'Failed' : running ? 'Waiting' : 'Done'}
            </span>
          )}
        </div>
        {failed && block.output && (
          <div className="px-2.5 pb-2 text-[11px] text-[#f85149] whitespace-pre-wrap">{block.output}</div>
        )}
      </div>
    )
  }

  const expanded = open || waiting
  const isRead = block.name === 'read_file'
  const isSearch = block.name === 'search_files' || block.name === 'list_files'
  const Icon = block.kind === 'python' ? Terminal : isRead ? Eye : isSearch ? Search : Check
  const label =
    block.kind === 'python'
      ? running
        ? 'Running Python code'
        : 'Ran Python code'
      : isRead && path
        ? `${running ? 'Reading' : 'Read'} ${basename(path)}`
        : (TOOL_LABELS[block.name] ?? ['Running tool', 'Ran tool'])[running ? 0 : 1]

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 py-1 text-left text-[#a39a8b] hover:text-[#f0a93b]"
      >
        {waiting ? (
          <Clock size={12} className="text-[#d29922] shrink-0" />
        ) : running ? (
          <Loader2 size={12} className="animate-spin text-[#938a7c] shrink-0" />
        ) : failed ? (
          <X size={12} className="text-[#f85149] shrink-0" />
        ) : (
          <Icon size={12} className="text-[#938a7c] shrink-0" />
        )}
        <span className="flex-1 truncate">{waiting ? 'Waiting for approval' : label}</span>
        <ChevronDown size={12} className={cn('text-[#938a7c] shrink-0 transition-transform', expanded && 'rotate-180')} />
      </button>

      {waiting && (
        <div className="pl-5 pb-1 flex items-center gap-3">
          <RunMenu id={block.id} />
          <button
            type="button"
            onClick={() => answerRun(block.id, 'decline')}
            className="text-xs text-[#ff7b72] hover:underline"
          >
            Decline
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateRows: expanded ? '1fr' : '0fr', transition: 'grid-template-rows 150ms ease-out' }}>
        <div className="overflow-hidden min-h-0">
          <div className="pl-5 py-1.5 space-y-2">
            <pre className="whitespace-pre-wrap break-all text-[#d9d2c4] font-mono text-[11px] max-h-48 overflow-y-auto">
              {block.input}
            </pre>
            {block.output !== undefined && (
              <pre
                className={cn(
                  'whitespace-pre-wrap break-all font-mono text-[11px] max-h-48 overflow-y-auto border-t border-[#2a261f] pt-2',
                  failed ? 'text-[#f85149]' : 'text-[#938a7c]'
                )}
              >
                {block.output}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}