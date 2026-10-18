import { ChevronLeft, History, Plus } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useChatList, startNewChat } from '../lib/chats/chatStore'

export function ChatHeader() {
  const chatId = useChatList((s) => s.chatId)
  const list = useChatList((s) => s.list)
  const showList = useChatList((s) => s.showList)
  const setShowList = useChatList((s) => s.setShowList)
  const hasProject = useAppStore((s) => s.projectId) !== null
  const title = list.find((c) => c.id === chatId)?.title ?? 'New chat'

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-[#30363d] shrink-0">
      {showList ? (
        <span className="rounded bg-[#21262d] px-2 py-0.5 text-xs font-medium text-[#e6edf3]">Chat</span>
      ) : (
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            title="Sessions"
            onClick={() => setShowList(true)}
            className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d]"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="truncate text-xs text-[#e6edf3]">{title}</span>
        </div>
      )}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          title="New chat"
          onClick={() => {
            setShowList(false)
            startNewChat()
          }}
          className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d]"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          title={hasProject ? 'Sessions' : 'Sessions (open a workspace to save chats)'}
          onClick={() => setShowList(!showList)}
          className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d]"
        >
          <History size={14} />
        </button>
      </div>
    </div>
  )
}