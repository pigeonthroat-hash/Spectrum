import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, PanelBottom, PanelLeft, PanelRight, Search, Settings } from 'lucide-react'
import { SettingsDialog } from './components/SettingsDialog'
import logo from './assets/logo.png'
import { AccountButton } from './components/AccountButton'
import { SaveController } from './components/SaveController'
import { Workspace } from './components/Workspace'
import { DragGhost } from './components/DragGhost'
import { GlassSurface } from './components/GlassSurface'
import { ActivityBar } from './components/ActivityBar'
import { StatusBar } from './components/StatusBar'
import { Toasts } from './components/Toasts'
import { QuickOpen } from './components/QuickOpen'
import { useAppStore } from './store/useAppStore'
import { requestClose } from './lib/closing'
import { useBottomPanel } from './lib/panel/bottom'
import { useQuickOpen } from './lib/editor/quickOpen'

export default function App() {
  const showExplorer = useAppStore((s) => s.showExplorer)
  const showAI = useAppStore((s) => s.showAI)
  const projectName = useAppStore((s) => s.projectName)
  const toggleExplorer = useAppStore((s) => s.toggleExplorer)
  const toggleAI = useAppStore((s) => s.toggleAI)
  const bottomOpen = useBottomPanel((s) => s.open)
  const [showSettings, setShowSettings] = useState(false)

  // Hiding a panel slides it away first. Showing it is instant.
  const togglePanel = (id: 'explorer' | 'chat') => {
    const visible = id === 'explorer' ? showExplorer : showAI
    if (visible) requestClose(id)
    else if (id === 'explorer') toggleExplorer()
    else toggleAI()
  }

  // Ctrl+B explorer, Ctrl+Alt+B chat, Ctrl+J bottom panel, Ctrl+P Quick Open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key === 'b') {
        e.preventDefault()
        if (e.altKey) togglePanel('chat')
        else togglePanel('explorer')
      } else if (key === 'j' && !e.altKey) {
        e.preventDefault()
        useBottomPanel.getState().toggle()
      } else if (key === 'p' && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        useQuickOpen.getState().setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showExplorer, showAI, toggleExplorer, toggleAI])

  const toggleClass = (on: boolean) =>
    `p-1.5 rounded hover:bg-[#2a261f] hover:text-white ${on ? 'text-white bg-[#2a261f]' : 'text-[#938a7c]'}`
  const navClass = 'p-1 rounded text-[#4a4338] cursor-not-allowed'

  return (
    <div id="spectrum-root" className="h-[100dvh] w-screen flex flex-col bg-[#1a1814] text-[#ece6da] overflow-clip">
      {/* Title bar: navigation, command bar, and layout toggles, like Cursor */}
      <header className="relative h-9 flex items-center gap-2 px-2 border-b border-[#2d2921] bg-[#15130f] shrink-0 select-none">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <img src={logo} alt="" className="h-4 w-auto" />
          <span className="font-semibold text-sm tracking-tight text-[#ece6da]">Spectrum</span>
          <span className="hidden lg:inline text-[10px] px-1.5 py-0.5 rounded bg-[#2a261f] text-[#938a7c]">
            v0.1 · Free models
          </span>
          <div className="hidden md:flex items-center gap-0.5 ml-1">
            <button type="button" disabled title="Back (no history yet)" className={navClass}>
              <ArrowLeft size={14} />
            </button>
            <button type="button" disabled title="Forward (no history yet)" className={navClass}>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Command bar: opens Quick Open. The glass pane sits behind the button and its label. */}
        <GlassSurface
          zIndex={50}
          enabled={false}
          className="hidden md:block w-[min(420px,40vw)] h-6 rounded-md border border-[#2d2921]"
        >
          <button
            type="button"
            onClick={() => useQuickOpen.getState().setOpen(true)}
            title="Quick Open (Ctrl+P)"
            className="flex items-center gap-2 w-full h-full px-2 text-[11px] text-[#938a7c] hover:text-[#ece6da]"
          >
            <Search size={12} className="shrink-0" />
            <span className="truncate flex-1 text-center">{projectName ?? 'Spectrum'}</span>
          </button>
        </GlassSurface>

        <div className="flex items-center gap-1 flex-1 justify-end min-w-0">
          <div className="hidden md:flex items-center gap-1">
            <button type="button" onClick={() => togglePanel('explorer')} className={toggleClass(showExplorer)} title="Toggle Explorer (Ctrl+B)">
              <PanelLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => useBottomPanel.getState().toggle()}
              className={toggleClass(bottomOpen)}
              title="Toggle Panel (Ctrl+J)"
            >
              <PanelBottom size={16} />
            </button>
            <button type="button" onClick={() => togglePanel('chat')} className={toggleClass(showAI)} title="Toggle Chat (Ctrl+Alt+B)">
              <PanelRight size={16} />
            </button>
          </div>
          <AccountButton />
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded hover:bg-[#2a261f] text-[#938a7c] hover:text-white"
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 min-w-0">
        <ActivityBar />
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="flex-1 flex min-h-0 min-w-0">
            <Workspace />
          </div>
        </div>
      </div>

      <DragGhost />
      <SaveController />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <QuickOpen />
      <Toasts />

      <StatusBar />
    </div>
  )
}