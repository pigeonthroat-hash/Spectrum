import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useChatList, openChat, refreshChatList } from '../lib/chats/chatStore'

function ago(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1d' : `${days}d`
}

// Shown in an empty chat, at the bottom: the most recent saved chats
export function PastChats() {
  const projectId = useAppStore((s) => s.projectId)
  const list = useChatList((s) => s.list)
  const setShowList = useChatList((s) => s.setShowList)

  useEffect(() => {
    if (projectId) void refreshChatList(projectId)
  }, [projectId])

  if (!projectId || list.length === 0) return null

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between px-1 pb-1 text-xs text-[#938a7c]">
        <span>Past chats</span>
        <button type="button" onClick={() => setShowList(true)} className="hover:text-[#f0a93b]">
          View all
        </button>
      </div>
      {list.slice(0, 5).map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => void openChat(projectId, c.id)}
          className="w-full flex items-center justify-between gap-2 rounded px-1 py-1 text-left text-xs text-[#d9d2c4] hover:bg-[#2a261f]"
        >
          <span className="truncate">{c.title}</span>
          <span className="shrink-0 text-[#938a7c]">{ago(c.updatedAt)}</span>
        </button>
      ))}
    </div>
  )
}
