import { Folder, Code2, MessageSquare } from 'lucide-react'
import { useAppStore, type MobileView } from '../store/useAppStore'
import { FileExplorer } from './FileExplorer'
import { AISidebar } from './AISidebar'
import { CodeEditor } from './CodeEditor'
import { cn } from '../lib/utils'

const VIEWS: { id: MobileView; label: string; icon: typeof Folder }[] = [
  { id: 'explorer', label: 'Files', icon: Folder },
  { id: 'editor', label: 'Editor', icon: Code2 },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
]

// Phone layout: one panel fills the screen, with a bar at the bottom to switch
export function MobileWorkspace() {
  const view = useAppStore((s) => s.mobileView)
  const setView = useAppStore((s) => s.setMobileView)

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col">
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 flex flex-col">
          {view === 'explorer' && <FileExplorer />}
          {view === 'editor' && <CodeEditor />}
          {view === 'chat' && <AISidebar />}
        </div>
      </div>

      <nav className="shrink-0 grid grid-cols-3 border-t border-[#30363d] bg-[#161b22] pb-[env(safe-area-inset-bottom)]">
        {VIEWS.map((v) => {
          const Icon = v.icon
          const active = view === v.id
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2 text-[11px]',
                active ? 'text-white' : 'text-[#8b949e]'
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