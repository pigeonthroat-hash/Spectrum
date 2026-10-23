import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react'
import { GripVertical, Maximize2, Minimize2, Minus, X } from 'lucide-react'
import { useAppStore, type PanelId } from '../store/useAppStore'
import { requestClose } from '../lib/closing'
import { useDragStore } from '../lib/dragStore'
import { beginPointerDrag } from '../lib/pointerDrag'

// Wraps a panel with a header: drag to move it, double-click to maximize,
// and buttons to maximize, collapse, or close.
export function PanelFrame({ id, title, children }: { id: PanelId; title: string; children: ReactNode }) {
  const maximized = useAppStore((s) => s.maximized)
  const toggleMaximized = useAppStore((s) => s.toggleMaximized)
  const setCollapsed = useAppStore((s) => s.setCollapsed)
  const isMaximized = maximized === id

  const onHeaderPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    beginPointerDrag(
      e,
      () => ({ kind: 'panel', id, label: title }),
      (x) => {
        // Left or right third of the workspace picks the side
        const ws = document.querySelector<HTMLElement>('[data-workspace]')
        if (!ws) return
        const r = ws.getBoundingClientRect()
        const rel = (x - r.left) / r.width
        useDragStore.getState().setDockSide(rel < 0.3 ? 'left' : rel > 0.7 ? 'right' : null)
      },
      () => {
        const side = useDragStore.getState().dockSide
        if (side) useAppStore.getState().dockPanel(id, side)
      }
    )
  }

  return (
    <div className="h-full flex flex-col min-w-0 min-h-0 bg-[#1a1814]">
      <div
        onPointerDown={onHeaderPointerDown}
        onDoubleClick={() => toggleMaximized(id)}
        title="Drag to move. Double-click to maximize."
        className="h-7 shrink-0 flex items-center justify-between gap-2 px-2 border-b border-[#2d2921] bg-[#15130f] select-none cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical size={12} className="text-[#4a4338] shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#938a7c] truncate">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0" onDoubleClick={(e) => e.stopPropagation()}>
          <HeaderButton title={isMaximized ? 'Restore' : 'Maximize'} onClick={() => toggleMaximized(id)}>
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </HeaderButton>
          <HeaderButton title="Collapse" onClick={() => setCollapsed(id, true)}>
            <Minus size={12} />
          </HeaderButton>
          <HeaderButton title="Close" onClick={() => requestClose(id)}>
            <X size={12} />
          </HeaderButton>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  )
}

function HeaderButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="p-1 rounded text-[#938a7c] hover:text-white hover:bg-[#2a261f]"
    >
      {children}
    </button>
  )
}