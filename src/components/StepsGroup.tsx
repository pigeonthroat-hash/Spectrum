import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Block, ToolBlock as ToolBlockData, TextBlock } from '../lib/agent/types'
import { ToolBlock } from './ToolBlock'
import { cn } from '../lib/utils'

export type Segment = TextBlock | { type: 'steps'; id: string; blocks: ToolBlockData[] }

// Puts consecutive tool rows into one steps group, so they can be opened and closed together
export function groupBlocks(blocks: Block[]): Segment[] {
  const out: Segment[] = []
  for (const b of blocks) {
    if (b.type === 'text') {
      out.push(b)
      continue
    }
    const last = out[out.length - 1]
    if (last && last.type === 'steps') last.blocks.push(b)
    else out.push({ type: 'steps', id: b.id, blocks: [b] })
  }
  return out
}

// "Completed 3 steps". Closed by default, and it stays as the user left it.
// A step waiting for approval is still shown below, so it can be accepted without opening the list.
export function StepsGroup({ blocks }: { blocks: ToolBlockData[] }) {
  const [open, setOpen] = useState(false)
  const running = blocks.some((b) => b.status === 'running' || b.status === 'awaiting')
  const waiting = blocks.filter((b) => b.status === 'awaiting')
  const n = blocks.length
  const label = running ? `Running ${n} step${n === 1 ? '' : 's'}` : `Completed ${n} step${n === 1 ? '' : 's'}`

  return (
    <div className="space-y-1.5">
      <div className="rounded-md border border-[#30363d] bg-[#0d1117]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-[#8b949e] hover:text-[#e6edf3]"
        >
          <ChevronDown size={12} className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
          <span>{label}</span>
        </button>
        {open && (
          <div className="px-1.5 pb-1.5 space-y-1.5">
            {blocks.map((b) => (
              <ToolBlock key={b.id} block={b} />
            ))}
          </div>
        )}
      </div>
      {!open && waiting.map((b) => <ToolBlock key={b.id} block={b} />)}
    </div>
  )
}