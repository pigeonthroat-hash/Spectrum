import type { ReactNode } from 'react'
import { Blocks, ChevronDown, Files, GitBranch, Search } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { requestClose } from '../lib/closing'
import { cn } from '../lib/utils'

// The narrow strip on the far left. Only Explorer works for now; the rest arrive in later phases.
export function ActivityBar() {
  const showExplorer = useAppStore((s) => s.showExplorer)
  const toggleExplorer = useAppStore((s) => s.toggleExplorer)

  const item = (label: string, icon: ReactNode, active: boolean, onClick?: () => void) => (
    <button
      type="button"
      title={onClick ? label : `${label} (coming later)`}
      disabled={!onClick}
      onClick={onClick}
      className={cn(
        'relative w-full h-10 flex items-center justify-center',
        onClick ? (active ? 'text-[#e6edf3]' : 'text-[#8b949e] hover:text-[#e6edf3]') : 'text-[#484f58] cursor-not-allowed'
      )}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-[#e6edf3]" />}
      {icon}
    </button>
  )

  return (
    <nav className="hidden md:flex w-11 shrink-0 flex-col border-r border-[#30363d] bg-[#0d1117]">
      {item('Explorer', <Files size={18} />, showExplorer, () => {
        if (showExplorer) requestClose('explorer')
        else toggleExplorer()
      })}
      {item('Search', <Search size={18} />, false)}
      {item('Source Control', <GitBranch size={18} />, false)}
      {item('Extensions', <Blocks size={18} />, false)}
      <div className="mt-auto">{item('More', <ChevronDown size={18} />, false)}</div>
    </nav>
  )
}