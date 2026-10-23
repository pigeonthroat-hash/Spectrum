import { cn } from '../lib/utils'

const TABS = [
  { id: 'chat', label: 'Chat', ready: true },
  { id: 'composer', label: 'Composer', ready: false },
  { id: 'bug', label: 'Bug Finder', ready: false },
]

export function ChatTabs() {
  return (
    <div className="flex items-center gap-1 px-3 border-b border-[#2d2921] text-xs shrink-0">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          disabled={!t.ready}
          title={t.ready ? undefined : 'Coming soon'}
          className={cn(
            'px-2 py-1.5 border-b-2 -mb-px',
            t.ready ? 'text-[#ece6da] border-[#f0a93b]' : 'text-[#6f675a] border-transparent cursor-not-allowed'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
