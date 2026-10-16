import { useState } from 'react'
import { Check, ChevronDown, Loader2, X } from 'lucide-react'
import type { ToolBlock as ToolBlockData } from '../lib/agent/types'
import { TOOL_LABELS } from '../lib/agent/types'
import { cn } from '../lib/utils'

// One collapsible row for a tool or Python run: "Running Python Code" -> "Ran Python Code"
export function ToolBlock({ block }: { block: ToolBlockData }) {
  const [open, setOpen] = useState(false)
  const labels: [string, string] =
    block.kind === 'python' ? ['Running Python Code', 'Ran Python Code'] : (TOOL_LABELS[block.name] ?? ['Running tool', 'Ran tool'])
  const running = block.status === 'running'
  const failed = block.status === 'error'

  return (
    <div className="rounded-md border border-[#30363d] bg-[#0d1117] text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[#c9d1d9]"
      >
        {running ? (
          <Loader2 size={12} className="animate-spin text-[#8b949e] shrink-0" />
        ) : failed ? (
          <X size={12} className="text-[#f85149] shrink-0" />
        ) : (
          <Check size={12} className="text-[#3fb950] shrink-0" />
        )}
        <span className="flex-1 truncate">{running ? labels[0] : labels[1]}</span>
        <ChevronDown size={12} className={cn('text-[#8b949e] shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-[#30363d] p-2 space-y-2">
          <pre className="whitespace-pre-wrap break-all text-[#c9d1d9] font-mono text-[11px] max-h-48 overflow-y-auto">
            {block.input}
          </pre>
          {block.output !== undefined && (
            <pre
              className={cn(
                'whitespace-pre-wrap break-all font-mono text-[11px] max-h-48 overflow-y-auto border-t border-[#21262d] pt-2',
                failed ? 'text-[#f85149]' : 'text-[#8b949e]'
              )}
            >
              {block.output}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}