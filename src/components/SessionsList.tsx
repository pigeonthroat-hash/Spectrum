import { useEffect, useState } from 'react'
import { Check, RotateCw, Search, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useChatList, openChat, refreshChatList } from '../lib/chats/chatStore'
import { cn } from '../lib/utils'

function ago(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

// The "Sessions" view: every saved chat in the workspace. Click one to open it.
export function SessionsList() {
  const projectId = useAppStore((s) => s.projectId)
  const list = useChatList((s) => s.list)
  const chatId = useChatList((s) => s.chatId)
  const setShowList = useChatList((s) => s.setShowList)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (projectId) void refreshChatList(projectId)
  }, [projectId])

  const shown = list.filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-xs font-semibold text-[#e6edf3]">Sessions</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Refresh"
            onClick={() => projectId && void refreshChatList(projectId)}
            className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d]"
          >
            <RotateCw size={13} />
          </button>
          <button
            type="button"
            title="Search"
            onClick={() => setSearching((v) => !v)}
            className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d]"
          >
            <Search size={13} />
          </button>
          <button
            type="button"
            title="Close"
            onClick={() => setShowList(false)}
            className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d]"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {searching && (
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats"
          className="mb-2 w-full rounded bg-[#0d1117] border border-[#30363d] px-2 py-1 text-xs text-[#e6edf3] outline-none focus:border-[#58a6ff]"
        />
      )}

      {!projectId && <p className="px-1 py-2 text-xs text-[#8b949e]">Open a workspace to save chats.</p>}
      {projectId && shown.length === 0 && <p className="px-1 py-2 text-xs text-[#8b949e]">No saved chats yet.</p>}

      {shown.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => {
            setShowList(false)
            if (projectId) void openChat(projectId, c.id)
          }}
          className={cn(
            'w-full flex items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-[#21262d]',
            c.id === chatId && 'bg-[#21262d]'
          )}
        >
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#8b949e]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-[#e6edf3]">{c.title}</span>
            <span className="block text-[11px] text-[#8b949e]">{ago(c.updatedAt)}</span>
          </span>
          {c.id === chatId && <Check size={13} className="mt-1 shrink-0 text-[#8b949e]" />}
        </button>
      ))}
    </div>
  )
}