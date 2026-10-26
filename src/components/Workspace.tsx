import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore, type PanelId } from '../store/useAppStore'
import { PanelFrame } from './PanelFrame'
import { MobileWorkspace } from './MobileWorkspace'
import { useIsMobile } from '../lib/useIsMobile'
import { LeftSidebar } from './LeftSidebar'
import { AISidebar } from './AISidebar'
import { CodeEditor } from './CodeEditor'
import { BottomPanel } from './BottomPanel'

const MIN_WIDTH = 180
const STRIP_WIDTH = 28 // width of the collapsed strip
// The sidebar on the left, the chat in the centre, and the editor on the right
// Default sizes as shares of the window width, so they look the same at any zoom level
const DEFAULT_RATIO: Record<PanelId, number> = { explorer: 350 / 1920, chat: 830 / 1920 }
const TITLE: Record<PanelId, string> = { explorer: 'Explorer', chat: 'Chat' }

// Sizes are stored as shares of the window width, so they keep their proportions at any zoom level
function widthOf(id: PanelId): number {
  const s = useAppStore.getState()
  return Math.round(window.innerWidth * (id === 'explorer' ? s.explorerRatio : s.editorRatio))
}

// The chat's divider sets the editor's width, since the editor is the panel with a fixed width
function setWidth(id: PanelId, width: number) {
  const vw = window.innerWidth
  const ratio = Math.max(MIN_WIDTH / vw, Math.min(0.5, width / vw))
  const s = useAppStore.getState()
  if (id === 'explorer') s.setExplorerRatio(ratio)
  else s.setEditorRatio(ratio)
}

export function Workspace() {
  const mobile = useIsMobile()
  const showExplorer = useAppStore((s) => s.showExplorer)
  const showAI = useAppStore((s) => s.showAI)
  const explorerCollapsed = useAppStore((s) => s.explorerCollapsed)
  const explorerRatio = useAppStore((s) => s.explorerRatio)
  const editorRatio = useAppStore((s) => s.editorRatio)
  // The window width, so the panels are redrawn when it changes (including zoom)
  const [vw, setVw] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const explorerWidth = Math.round(vw * explorerRatio)
  const sidebarWidth = Math.round(vw * editorRatio)
  const maximized = useAppStore((s) => s.maximized)

  if (mobile) return <MobileWorkspace />

  // One panel fills the whole area
  if (maximized) {
    return (
      <div className="flex-1 min-h-0 min-w-0">
        <PanelContent id={maximized} />
      </div>
    )
  }

  const leftExpanded = showExplorer && !explorerCollapsed

  return (
    <div data-workspace className="flex-1 flex min-h-0 min-w-0 relative">
      {/* Left: the sidebar */}
      {showExplorer && (
        <div
          className="relative flex-none h-full overflow-clip min-w-0"
          style={{ width: explorerCollapsed ? STRIP_WIDTH : explorerWidth, transition: 'width 220ms cubic-bezier(0.2, 0.7, 0.2, 1)' }}
        >
          <div className="absolute top-0 bottom-0 left-0" style={{ width: explorerWidth }}>
            <PanelContent id="explorer" />
          </div>
          <CollapsedStrip id="explorer" side="left" open={explorerCollapsed} />
        </div>
      )}
      {leftExpanded && (
        <Splitter
          onResize={(dx) => setWidth('explorer', widthOf('explorer') + dx)}
          onReset={() => useAppStore.getState().setExplorerRatio(DEFAULT_RATIO.explorer)}
        />
      )}

      {/* Centre: the chat, which takes the remaining space */}
      {showAI && (
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <AISidebar />
        </div>
      )}

      {/* Right: the code editor, at a set width when the chat is shown */}
      {showAI && (
        <Splitter
          onResize={(dx) => setWidth('chat', widthOf('chat') - dx)}
          onReset={() => useAppStore.getState().setEditorRatio(DEFAULT_RATIO.chat)}
        />
      )}
      <div
        className={showAI ? 'flex-none min-w-0 min-h-0 flex flex-col' : 'flex-1 min-w-0 min-h-0 flex flex-col'}
        style={showAI ? { width: sidebarWidth } : undefined}
      >
        <div className="flex-1 min-h-0 min-w-0">
          <CodeEditor />
        </div>
        <BottomPanel />
      </div>
    </div>
  )
}

function PanelContent({ id }: { id: PanelId }) {
  // The left side is the sidebar itself, so it has no panel header
  if (id === 'explorer') return <LeftSidebar />
  return <PanelFrame id={id} title={TITLE[id]}><AISidebar /></PanelFrame>
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
      className="w-1 shrink-0 cursor-col-resize bg-[#2d2921] hover:bg-[#f0a93b] transition-colors"
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
      className={`absolute top-0 bottom-0 ${side === 'left' ? 'left-0' : 'right-0'} w-7 flex flex-col items-center gap-3 py-3 bg-[#15130f] border-x border-[#2d2921] text-[#938a7c] hover:text-white hover:bg-[#2a261f]`}
      style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 180ms ease-out' }}
    >
      <Icon size={14} />
      <span className="text-[11px] uppercase tracking-wider" style={{ writingMode: 'vertical-rl' }}>
        {TITLE[id]}
      </span>
    </button>
  )
}