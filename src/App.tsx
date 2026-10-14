import { FileExplorer } from './components/FileExplorer'
import { CodeEditor } from './components/CodeEditor'
import { AISidebar } from './components/AISidebar'
import { useAppStore } from './store/useAppStore'
import { PanelLeft, PanelRight, Settings } from 'lucide-react'

export default function App() {
  const {
    showExplorer,
    showAI,
    explorerWidth,
    sidebarWidth,
    toggleExplorer,
    toggleAI,
  } = useAppStore()

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0d1117] text-[#e6edf3] overflow-hidden">
      {/* Top bar */}
      <header className="h-9 flex items-center justify-between px-3 border-b border-[#30363d] bg-[#161b22] shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm tracking-tight text-[#e6edf3]">
            Spectrum
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e]">
            v0.1 · Free models
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleExplorer}
            className="p-1.5 rounded hover:bg-[#21262d] text-[#8b949e] hover:text-white"
            title="Toggle Explorer"
          >
            <PanelLeft size={16} />
          </button>
          <button
            onClick={toggleAI}
            className="p-1.5 rounded hover:bg-[#21262d] text-[#8b949e] hover:text-white"
            title="Toggle AI Sidebar"
          >
            <PanelRight size={16} />
          </button>
          <button className="p-1.5 rounded hover:bg-[#21262d] text-[#8b949e] hover:text-white">
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex min-h-0">
        {showExplorer && (
          <div style={{ width: explorerWidth }} className="shrink-0">
            <FileExplorer />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <CodeEditor />
        </div>

        {showAI && (
          <div style={{ width: sidebarWidth }} className="shrink-0">
            <AISidebar />
          </div>
        )}
      </div>

      {/* Status bar */}
      <footer className="h-6 flex items-center justify-between px-3 border-t border-[#30363d] bg-[#161b22] text-[11px] text-[#8b949e] shrink-0">
        <div className="flex items-center gap-3">
          <span>Ready</span>
          <span className="text-[#3fb950]">● Free models enabled</span>
        </div>
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>TypeScript</span>
        </div>
      </footer>
    </div>
  )
}
