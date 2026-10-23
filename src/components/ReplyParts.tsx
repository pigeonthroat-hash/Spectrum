import { useState } from 'react'
import { Check, ChevronDown, File } from 'lucide-react'
import type { Block } from '../lib/agent/types'
import { useAppStore, type ChatMessage } from '../store/useAppStore'
import { usedFiles, type ReviewRow } from '../lib/chats/replyMeta'
import { cn } from '../lib/utils'

const baseName = (p: string) => p.split('/').pop() ?? p

// Shows what sits under a reply: the to-do list, the review card, and the files it used
export function ReplyParts({ msg, blocks }: { msg: ChatMessage; blocks: Block[] }) {
  const todos = msg.todos ?? []
  const review = msg.review ?? []
  const used = usedFiles(blocks)
  if (todos.length === 0 && review.length === 0 && used.length === 0) return null
  return (
    <div className="space-y-2">
      {todos.length > 0 && <TodosBlock todos={todos} />}
      {review.length > 0 && <ReviewCard rows={review} />}
      {used.length > 0 && <UsedFiles paths={used} />}
    </div>
  )
}

function TodosBlock({ todos }: { todos: { text: string; done: boolean }[] }) {
  const [open, setOpen] = useState(true)
  const done = todos.filter((t) => t.done).length
  return (
    <div className="rounded-md border border-[#2d2921] bg-[#1a1814] text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-2.5 py-2 text-[#ece6da]"
      >
        <span className="font-medium">To-dos</span>
        <span className="flex items-center gap-2 text-[#938a7c]">
          <span>
            {done} of {todos.length} completed
          </span>
          <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && (
        <ul className="border-t border-[#2d2921] px-2.5 py-2 space-y-1.5">
          {todos.map((t, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className={cn(
                  'mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
                  t.done ? 'border-[#f0a93b] bg-[#f0a93b]' : 'border-[#4a4338]'
                )}
              >
                {t.done && <Check size={10} className="text-white" />}
              </span>
              <span className={cn(t.done ? 'text-[#938a7c] line-through' : 'text-[#ece6da]')}>{t.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ReviewCard({ rows }: { rows: ReviewRow[] }) {
  const openTabs = useAppStore((s) => s.openTabs)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  // A file can only be shown in the editor when it is open
  const open = (path: string) => {
    if (openTabs.some((t) => t.path === path)) setActiveTab(path)
  }
  return (
    <div className="rounded-md border border-[#2d2921] bg-[#1a1814] text-xs">
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-[#2d2921]">
        <span className="text-[#ece6da]">
          {rows.length} file{rows.length === 1 ? '' : 's'} changed
        </span>
        <button type="button" onClick={() => open(rows[0].path)} className="text-[#f0a93b] hover:underline">
          Review
        </button>
      </div>
      <ul className="divide-y divide-[#2a261f]">
        {rows.map((r) => (
          <li key={r.path}>
            <button
              type="button"
              onClick={() => open(r.path)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-[#15130f]"
            >
              <span className="truncate text-[#d9d2c4]">{baseName(r.path)}</span>
              <span className="shrink-0 font-mono">
                <span className="text-[#3fb950]">+{r.added}</span> <span className="text-[#f85149]">-{r.removed}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function UsedFiles({ paths }: { paths: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#938a7c]">
      <span>Used</span>
      {paths.map((p) => (
        <span key={p} className="inline-flex items-center gap-1 rounded bg-[#2a261f] px-1.5 py-0.5 text-[#d9d2c4]">
          <File size={10} />
          {baseName(p)}
        </span>
      ))}
    </div>
  )
}
