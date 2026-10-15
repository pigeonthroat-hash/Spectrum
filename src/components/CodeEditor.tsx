import Editor, { DiffEditor } from '@monaco-editor/react'
import { useAppStore } from '../store/useAppStore'
import { X } from 'lucide-react'
import { cn } from '../lib/utils'
import { WelcomeScreen } from './WelcomeScreen'

export function CodeEditor() {
  const {
    openTabs,
    activeTabPath,
    setActiveTab,
    closeTab,
    updateTabContent,
    pendingDiffs,
  } = useAppStore()

  const activeTab = openTabs.find((t) => t.path === activeTabPath)
  const activeDiff = pendingDiffs.find((d) => d.path === activeTabPath)

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Tabs */}
      <div className="flex items-center bg-[#161b22] border-b border-[#30363d] overflow-x-auto shrink-0">
        {openTabs.length === 0 && (
          <div className="px-4 py-2 text-sm text-[#8b949e]">
            No file open
          </div>
        )}
        {openTabs.map((tab) => (
          <div
            key={tab.path}
            className={cn(
              'group flex items-center gap-2 px-3 py-2 text-sm border-r border-[#30363d] cursor-pointer min-w-0',
              activeTabPath === tab.path
                ? 'bg-[#0d1117] text-white'
                : 'bg-[#161b22] text-[#8b949e] hover:bg-[#21262d]'
            )}
            onClick={() => setActiveTab(tab.path)}
          >
            <span className="truncate max-w-[140px]">
              {tab.isDirty && <span className="text-[#3fb950] mr-1">●</span>}
              {tab.name}
            </span>
            <button
              className="opacity-0 group-hover:opacity-100 hover:bg-[#30363d] rounded p-0.5"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.path)
              }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Editor area */}
      <div className="flex-1 relative">
        {!activeTab ? (
          <WelcomeScreen />
        ) : activeDiff ? (
          <DiffEditor
            height="100%"
            language={activeTab.language}
            original={activeDiff.original}
            modified={activeDiff.modified}
            theme="vs-dark"
            options={{
              readOnly: false,
              renderSideBySide: true,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        ) : (
          <Editor
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            theme="vs-dark"
            onChange={(value) => {
              if (value !== undefined) updateTabContent(activeTab.path, value)
            }}
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              minimap: { enabled: true, scale: 0.8 },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 8 },
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              cursorBlinking: 'smooth',
              smoothScrolling: true,
            }}
          />
        )}
      </div>
    </div>
  )
}
