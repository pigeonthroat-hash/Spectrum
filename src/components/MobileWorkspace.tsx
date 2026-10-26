import { Code2, Menu, MessageSquare } from 'lucide-react'
import { useAppStore, type MobileView } from '../store/useAppStore'
import { LeftSidebar } from './LeftSidebar'
import { AISidebar } from './AISidebar'
import { CodeEditor } from './CodeEditor'
import { cn } from '../lib/utils'

// The same three parts as the desktop, one at a time: the menu (sidebar and explorer), the chat, and the editor
const VIEWS: { id: MobileView; label: string; icon: typeof Menu }[] = [
  { id: 'explorer', label: 'Menu', icon: Menu },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'editor', label: 'Editor', icon: Code2 },
]

// Phone layout: one screen at a time, with a bar at the bottom to switch
export function MobileWorkspace() {
  const view = useAppStore((s) => s.mobileView)
  const setView = useAppStore((s) => s.setMobileView)

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col">
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 flex flex-col">
          {view === 'explorer' && <LeftSidebar />}
          {view === 'chat' && <AISidebar />}
          {view === 'editor' && <CodeEditor />}
        </div>
      </div>

      <nav className="shrink-0 grid grid-cols-3 border-t border-[#2d2921] bg-[#15130f] pb-[env(safe-area-inset-bottom)]">
        {VIEWS.map((v) => {
          const Icon = v.icon
          const active = view === v.id
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={cn(
                'flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-[11px]',
                active ? 'text-[#f0a93b]' : 'text-[#938a7c]'
              )}
            >
              <Icon size={18} />
              {v.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}