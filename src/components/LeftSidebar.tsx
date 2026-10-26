import { useEffect, type ComponentType } from 'react'
import { FolderTree, Plus, Search, Settings2, X } from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useChatList, openChat, refreshChatList, startNewChat } from '../lib/chats/chatStore'
import { useQuickOpen } from '../lib/editor/quickOpen'
import { FileExplorer } from './FileExplorer'
import { isMobileNow } from '../lib/useIsMobile'
import { useExplorerView } from '../lib/ui/explorerView'
import { CloudProjects } from './CloudProjects'
import { cn } from '../lib/utils'

// Listened for by App, which opens the Settings dialog
export const OPEN_SETTINGS_EVENT = 'spectrum:open-settings'

function ago(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1d' : `${days}d`
}

function NavItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<LucideProps>
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] text-[#d9d2c4] hover:bg-[#2a261f] hover:text-[#ece6da]"
    >
      <Icon size={15} className="shrink-0 text-[#938a7c]" />
      {label}
    </button>
  )
}

function SectionTitle({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pt-4 pb-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#938a7c]">{children}</span>
      {action}
    </div>
  )
}

// The left sidebar: a menu of actions, chats, and projects. Explorer slides over it as its own view.
export function LeftSidebar() {
  // Kept in a shared store, so the explorer stays open when you switch to the chat and back on a phone
  const explorerOpen = useExplorerView((s) => s.open)
  const setExplorerOpen = useExplorerView((s) => s.setOpen)
  const projectId = useAppStore((s) => s.projectId)
  const showAI = useAppStore((s) => s.showAI)
  const toggleAI = useAppStore((s) => s.toggleAI)
  const list = useChatList((s) => s.list)
  const chatId = useChatList((s) => s.chatId)
  const setShowList = useChatList((s) => s.setShowList)

  useEffect(() => {
    if (projectId) void refreshChatList(projectId)
    // With no project open, there is nothing to explore, so the explorer closes
    else setExplorerOpen(false)
  }, [projectId])

  // Shows the chat: on a phone it is its own screen, on desktop it is the centre panel
  const showChat = () => {
    if (isMobileNow()) useAppStore.getState().setMobileView('chat')
    else if (!showAI) toggleAI()
  }

  return (
    <div className="relative h-full overflow-hidden bg-[#1a1814]">
      {/* The menu */}
      <div className="h-full flex flex-col overflow-y-auto">
        <nav className="px-1.5 pt-2 pb-1 space-y-0.5">
          <NavItem
            icon={Plus}
            label="New Chat"
            onClick={() => {
              startNewChat()
              showChat()
            }}
          />
          <NavItem icon={Search} label="Search" onClick={() => useQuickOpen.getState().setOpen(true)} />
          {projectId && <NavItem icon={FolderTree} label="Explorer" onClick={() => setExplorerOpen(true)} />}
          <NavItem icon={Settings2} label="Customize" onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))} />
        </nav>

        <SectionTitle
          action={
            <button
              type="button"
              onClick={() => {
                showChat()
                setShowList(true)
              }}
              className="text-[11px] text-[#938a7c] hover:text-[#f0a93b]"
            >
              View all
            </button>
          }
        >
          Chats
        </SectionTitle>
        <div className="px-1.5 pb-2 space-y-0.5">
          {list.length === 0 && <p className="px-3 py-1 text-xs text-[#6f675a]">No saved chats yet</p>}
          {projectId &&
            list.slice(0, 5).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  showChat()
                  void openChat(projectId, c.id)
                }}
                className={cn(
                  'w-full flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-xs hover:bg-[#2a261f]',
                  c.id === chatId ? 'bg-[#2a261f] text-[#ece6da]' : 'text-[#c9bfae]'
                )}
              >
                <span className="truncate">{c.title}</span>
                <span className="shrink-0 text-[#6f675a]">{ago(c.updatedAt)}</span>
              </button>
            ))}
        </div>

        {!projectId && (
          <>
            <SectionTitle>Projects</SectionTitle>
            <div className="px-1.5 pb-4">
              <CloudProjects />
            </div>
          </>
        )}
      </div>

      {/* The explorer slides in over the menu, and slides back out when closed */}
      <div
        className={cn(
          'absolute inset-0 flex flex-col bg-[#1a1814] transition-transform duration-200 ease-out',
          explorerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#2d2921]">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#d9d2c4]">Explorer</span>
          <button
            type="button"
            title="Close explorer"
            onClick={() => setExplorerOpen(false)}
            className="p-1 rounded hover:bg-[#2a261f] text-[#938a7c] hover:text-[#ece6da]"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          {projectId && <FileExplorer />}
        </div>
      </div>
    </div>
  )
}