import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore, type PanelId } from '../store/useAppStore'
import { useDragStore } from '../lib/dragStore'
import { useClosing, CLOSE_MS } from '../lib/closing'
import { PanelFrame } from './PanelFrame'
import { MobileWorkspace } from './MobileWorkspace'
import { useIsMobile } from '../lib/useIsMobile'
import { FileExplorer } from './FileExplorer'
import { AISidebar } from './AISidebar'
import { CodeEditor } from './CodeEditor'
import { BottomPanel } from './BottomPanel'

const MIN_WIDTH = 180
const STRIP_WIDTH = 28 // width of the collapsed strip
const DEFAULT_WIDTH: Record<PanelId, number> = { explorer: 260, chat: 380 }
const TITLE: Record<PanelId, string> = { explorer: 'Explorer', chat: 'Chat' }

function widthOf(id: PanelId): number {
  const s = useAppStore.getState()
  return id === 'explorer' ? s.explorerWidth : s.sidebarWidth
}

function setWidth(id: PanelId, width: number) {
  const max = Math.round(window.innerWidth * 0.5)
  const clamped = Math.max(MIN_WIDTH, Math.min(max, width))
  const s = useAppStore.getState()
  if (id === 'explorer') s.setExplorerWidth(clamped)
  else s.setSidebarWidth(clamped)
}

// The main area: left panel, editor, right panel, with draggable dividers
export function Workspace() {
  const mobile = useIsMobile()
  const leftPanel = useAppStore((s) => s.leftPanel)
  const rightPanel = useAppStore((s) => s.rightPanel)
  const showExplorer = useAppStore((s) => s.showExplorer)
  const showAI = useAppStore((s) => s.showAI)
  const explorerCollapsed = useAppStore((s) => s.explorerCollapsed)
  const chatCollapsed = useAppStore((s) => s.chatCollapsed)
  const explorerWidth = useAppStore((s) => s.explorerWidth)
  const sidebarWidth = useAppStore((s) => s.sidebarWidth)
  const maximized = useAppStore((s) => s.maximized)
  const closing = useClosing((s) => s.closing)

  const isVisible = (id: PanelId) => (id === 'explorer' ? showExplorer : showAI)
  const isCollapsed = (id: PanelId) => (id === 'explorer' ? explorerCollapsed : chatCollapsed)

  if (mobile) return <MobileWorkspace />

  // One panel fills the whole area
  if (maximized) {
    return (
      <div className="flex-1 min-h-0 min-w-0">
        <PanelContent id={maximized} />
      </div>
    )
  }

  const leftExpanded = isVisible(leftPanel) && !isCollapsed(leftPanel)
  const rightExpanded = isVisible(rightPanel) && !isCollapsed(rightPanel)

  // The panel stays mounted. Collapsing animates the slot's width down to the strip, so the panel slides closed.
  const renderSlot = (id: PanelId, side: 'left' | 'right') => {
    if (!isVisible(id)) return null
    const collapsed = isCollapsed(id)
    const width = id === 'explorer' ? explorerWidth : sidebarWidth
    const anchor = side === 'left' ? 'left-0' : 'right-0'
    const leaving = closing === id
    return (
      <div
        className="relative shrink-0 h-full overflow-hidden min-w-0"
        style={{
          width: leaving ? 0 : collapsed ? STRIP_WIDTH : width,
          transition: `width ${CLOSE_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)`,
        }}
      >
        <div
          className={`absolute top-0 bottom-0 ${anchor}`}
          style={{
            width,
            transform: leaving ? `translateX(${side === 'left' ? '-100%' : '100%'})` : 'none',
            transition: `transform ${CLOSE_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)`,
          }}
        >
          <PanelContent id={id} />
        </div>
        <CollapsedStrip id={id} side={side} open={collapsed && !leaving} />
      </div>
    )
  }

  return (
    <div data-workspace className="flex-1 flex min-h-0 min-w-0 relative">
      {renderSlot(leftPanel, 'left')}
      {leftExpanded && (
        <Splitter
          onResize={(dx) => setWidth(leftPanel, widthOf(leftPanel) + dx)}
          onReset={() => setWidth(leftPanel, DEFAULT_WIDTH[leftPanel])}
        />
      )}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 min-w-0">
          <CodeEditor />
        </div>
        <BottomPanel />
      </div>
      {rightExpanded && (
        <Splitter
          onResize={(dx) => setWidth(rightPanel, widthOf(rightPanel) - dx)}
          onReset={() => setWidth(rightPanel, DEFAULT_WIDTH[rightPanel])}
        />
      )}
      {renderSlot(rightPanel, 'right')}

      <DropZone side="left" />
      <DropZone side="right" />
    </div>
  )
}

function PanelContent({ id }: { id: PanelId }) {
  return <PanelFrame id={id} title={TITLE[id]}>{id === 'explorer' ? <FileExplorer /> : <AISidebar />}</PanelFrame>
}

// Thin draggable divider. Drag to resize, double-click to reset.
function Splitter({ onResize, onReset }: { onResize: (dx: number) => void; onReset: () => void }) {
  const lastX = useRef<number | null>(null)
  const stop = () => {
    lastX.current = null
  }
  return (
    <div
      onPointerDown={(e) => {
        lastX.current = e.clientX
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (lastX.current === null) return
        const dx = e.clientX - lastX.current
        lastX.current = e.clientX
        if (dx !== 0) onResize(dx)
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={onReset}
      title="Drag to resize. Double-click to reset."
      className="w-1 shrink-0 cursor-col-resize bg-[#30363d] hover:bg-[#58a6ff] transition-colors"
    />
  )
}

// A collapsed panel is a thin strip. Click it to expand.
function CollapsedStrip({ id, side, open }: { id: PanelId; side: 'left' | 'right'; open: boolean }) {
  const setCollapsed = useAppStore((s) => s.setCollapsed)
  const Icon = side === 'left' ? ChevronRight : ChevronLeft
  return (
    <button
      onClick={() => setCollapsed(id, false)}
      title={`Expand ${TITLE[id]}`}
      tabIndex={open ? 0 : -1}
      className={`absolute top-0 bottom-0 ${side === 'left' ? 'left-0' : 'right-0'} w-7 flex flex-col items-center gap-3 py-3 bg-[#161b22] border-x border-[#30363d] text-[#8b949e] hover:text-white hover:bg-[#21262d]`}
      style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 180ms ease-out' }}
    >
      <Icon size={14} />
      <span className="text-[11px] uppercase tracking-wider" style={{ writingMode: 'vertical-rl' }}>
        {TITLE[id]}
      </span>
    </button>
  )
}

// Highlights a side while a panel is dragged over it
function DropZone({ side }: { side: 'left' | 'right' }) {
  const item = useDragStore((s) => s.item)
  const dockSide = useDragStore((s) => s.dockSide)
  if (item?.kind !== 'panel') return null
  const active = dockSide === side
  return (
    <div
      className={`pointer-events-none absolute top-0 bottom-0 ${side === 'left' ? 'left-0' : 'right-0'} w-[30%] z-40 flex items-center justify-center border-2 border-dashed transition-colors text-xs ${
        active ? 'border-[#58a6ff] bg-[#58a6ff]/15 text-[#58a6ff]' : 'border-[#30363d] text-transparent'
      }`}
    >
      {active ? `Dock ${item.label} on the ${side}` : ''}
    </div>
  )
}