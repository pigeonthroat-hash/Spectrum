import { isBinaryName } from '../lib/files/kinds'
import { FileViewer } from './FileViewer'
import Editor from '@monaco-editor/react'
import { InlineDiff } from './InlineDiff'
import { useAppStore } from '../store/useAppStore'
import { X, Check, Undo2, Redo2, Play, Eye } from 'lucide-react'
import { runActiveFile } from '../lib/run/runActive'
import { registerEditorActions } from '../lib/run/editorActions'
import { OutputPanel } from './OutputPanel'
import { cn } from '../lib/utils'
import { WelcomeScreen } from './WelcomeScreen'
import { AutoApplyMenu } from './AutoApplyMenu'
import { enableAutoApply } from '../lib/agent/autoApply'
import { applyPending, declinePending } from '../lib/agent/applyChange'
import { FileIcon } from './FileIcon'

export function CodeEditor() {
  const {
    openTabs,
    activeTabPath,
    setActiveTab,
    closeTab,
    updateTabContent,
    pendingDiffs,
    lastAccepted,
    redoItem,
    undoLastAccept,
    redoLastUndo,
  } = useAppStore()

  const projectId = useAppStore((s) => s.projectId)
  const activeTab = openTabs.find((t) => t.path === activeTabPath)
  const activeDiff = pendingDiffs.find((d) => d.path === activeTabPath)
  const canUndo = !!activeTab && lastAccepted?.path === activeTab.path
  const canRedo = !!activeTab && redoItem?.path === activeTab.path

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-[#0d1117]">
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
            <FileIcon name={tab.name} />
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
        {/* Run button: Preview for HTML, Run for everything else */}
        <div className="ml-auto flex items-center px-2 shrink-0">
          <button
            type="button"
            onClick={() => void runActiveFile()}
            disabled={!activeTab}
            title={activeTab?.language === 'html' ? 'Preview' : 'Run file'}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded text-[#e6edf3] hover:bg-[#21262d] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {activeTab?.language === 'html' ? <Eye size={13} /> : <Play size={13} />}
            {activeTab?.language === 'html' ? 'Preview' : 'Run'}
          </button>
        </div>
      </div>

      {/* Undo / Redo bar after an applied change */}
      {!activeDiff && activeTab && (canUndo || canRedo) && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#161b22] border-b border-[#30363d] shrink-0">
          <span className="text-xs text-[#8b949e]">
            {canUndo ? `Change applied to ${activeTab.name}` : `Change undone in ${activeTab.name}`}
          </span>
          <div className="flex gap-1.5">
            {canUndo && (
              <button
                onClick={undoLastAccept}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] rounded border border-[#30363d]"
              >
                <Undo2 size={12} /> Undo
              </button>
            )}
            {canRedo && (
              <button
                onClick={redoLastUndo}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] rounded border border-[#30363d]"
              >
                <Redo2 size={12} /> Redo
              </button>
            )}
          </div>
        </div>
      )}

      {/* Apply / Decline bar for a proposed change */}
      {activeDiff && activeTab && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#161b22] border-b border-[#30363d] shrink-0">
          <span className="text-xs text-[#8b949e]">Proposed change to {activeTab.name}</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => void applyPending(activeDiff.path)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[#238636] hover:bg-[#2ea043] text-white rounded"
            >
              <Check size={12} /> Apply
            </button>
            <button
              onClick={() => declinePending(activeDiff.path)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] rounded border border-[#30363d]"
            >
              <X size={12} /> Decline
            </button>
            <AutoApplyMenu
              onChoose={(scope) => {
                enableAutoApply(scope)
                // The change in front of you is applied too, since it belongs to this reply
                void applyPending(activeDiff.path)
              }}
            />
          </div>
        </div>
      )}

      {/* Editor area */}
      <div className="flex-1 min-h-0 relative">
        {!activeTab ? (
          <WelcomeScreen />
        ) : projectId && isBinaryName(activeTab.name) ? (
          <FileViewer projectId={projectId} path={activeTab.path} name={activeTab.name} />
        ) : activeDiff ? (
          <InlineDiff original={activeDiff.original} modified={activeDiff.modified} />
        ) : (
          <Editor
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            onMount={(editor) => registerEditorActions(editor)}
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
      <OutputPanel />
    </div>
  )
}