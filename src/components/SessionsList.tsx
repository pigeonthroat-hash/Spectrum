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
        <span className="text-xs font-semibold text-[#ece6da]">Sessions</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Refresh"
            onClick={() => projectId && void refreshChatList(projectId)}
            className="p-1 rounded text-[#938a7c] hover:text-white hover:bg-[#2a261f]"
          >
            <RotateCw size={13} />
          </button>
          <button
            type="button"
            title="Search"
            onClick={() => setSearching((v) => !v)}
            className="p-1 rounded text-[#938a7c] hover:text-white hover:bg-[#2a261f]"
          >
            <Search size={13} />
          </button>
          <button
            type="button"
            title="Close"
            onClick={() => setShowList(false)}
            className="p-1 rounded text-[#938a7c] hover:text-white hover:bg-[#2a261f]"
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
          className="mb-2 w-full rounded bg-[#1a1814] border border-[#2d2921] px-2 py-1 text-xs text-[#ece6da] outline-none focus:border-[#f0a93b]"
        />
      )}

      {!projectId && <p className="px-1 py-2 text-xs text-[#938a7c]">Open a workspace to save chats.</p>}
      {projectId && shown.length === 0 && <p className="px-1 py-2 text-xs text-[#938a7c]">No saved chats yet.</p>}

      {shown.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => {
            setShowList(false)
            if (projectId) void openChat(projectId, c.id)
          }}
          className={cn(
            'w-full flex items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-[#2a261f]',
            c.id === chatId && 'bg-[#2a261f]'
          )}
        >
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#938a7c]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-[#ece6da]">{c.title}</span>
            <span className="block text-[11px] text-[#938a7c]">{ago(c.updatedAt)}</span>
          </span>
          {c.id === chatId && <Check size={13} className="mt-1 shrink-0 text-[#938a7c]" />}
        </button>
      ))}
    </div>
  )
}