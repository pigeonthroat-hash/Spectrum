import { Circle, SplitSquareHorizontal } from 'lucide-react'
import { setRevealEditor } from '../lib/editor/reveal'
import { attachEditorStatus } from '../lib/editor/status'
import { ChevronRight } from 'lucide-react'
import { isBinaryName } from '../lib/files/kinds'
import { FileViewer } from './FileViewer'
import Editor from '@monaco-editor/react'
import '../lib/monacoLoader'
import { ReviewBar } from './ReviewBar'
import { isCreatePending } from '../lib/agent/decisions'
import { InlineDiff } from './InlineDiff'
import { useAppStore } from '../store/useAppStore'
import { X, Check, Undo2, Redo2, Play, Eye } from 'lucide-react'
import { runActiveFile } from '../lib/run/runActive'
import { registerEditorActions } from '../lib/run/editorActions'
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
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-[#201d18]">
      {/* Tabs */}
      <div className="flex items-center bg-[#15130f] border-b border-[#2d2921] overflow-x-auto shrink-0">
        {openTabs.length === 0 && (
          <div className="px-4 py-2 text-sm text-[#938a7c]">
            No file open
          </div>
        )}
        {openTabs.map((tab) => (
          <div
            key={tab.path}
            className={cn(
              'group flex items-center gap-2 px-3 py-2 text-sm border-r border-[#2d2921] cursor-pointer min-w-0',
              activeTabPath === tab.path
                ? 'bg-[#201d18] text-white shadow-[inset_0_2px_0_#f0a93b]'
                : 'bg-[#15130f] text-[#938a7c] hover:bg-[#2a261f]'
            )}
            onClick={() => setActiveTab(tab.path)}
          >
            <FileIcon name={tab.name} />
            <span className="truncate max-w-[140px]">{tab.name}</span>
            <button
              type="button"
              title={tab.isDirty ? 'Unsaved changes' : 'Close'}
              className={cn(
                'shrink-0 p-0.5 rounded hover:bg-[#2d2921]',
                tab.isDirty ? '' : activeTabPath === tab.path ? '' : 'opacity-0 group-hover:opacity-100'
              )}
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.path)
              }}
            >
              {tab.isDirty ? (
                <>
                  <Circle size={8} className="fill-current text-[#f0a93b] group-hover:hidden" />
                  <X size={12} className="hidden group-hover:block" />
                </>
              ) : (
                <X size={12} />
              )}
            </button>
          </div>
        ))}
        {/* Run button: Preview for HTML, Run for everything else */}
        <div className="ml-auto flex items-center px-2 shrink-0">
          <button
            type="button"
            disabled
            title="Split editor (coming later)"
            className="p-1.5 rounded text-[#4a4338] cursor-not-allowed"
          >
            <SplitSquareHorizontal size={14} />
          </button>
          <button
            type="button"
            onClick={() => void runActiveFile()}
            disabled={!activeTab}
            title={activeTab?.language === 'html' ? 'Preview' : 'Run file'}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded text-[#ece6da] hover:bg-[#2a261f] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {activeTab?.language === 'html' ? <Eye size={13} /> : <Play size={13} />}
            {activeTab?.language === 'html' ? 'Preview' : 'Run'}
          </button>
        </div>
      </div>

      {/* Breadcrumbs, like Cursor: folders, then the file */}
      {activeTab && (
        <div className="flex items-center gap-1 px-3 h-6 min-w-0 text-[11px] text-[#938a7c] bg-[#201d18] border-b border-[#2a261f]">
          {activeTab.path.split('/').map((seg, i, all) => (
            <span key={i} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight size={10} className="shrink-0 text-[#6f675a]" />}
              <span className={cn('truncate', i === all.length - 1 && 'text-[#d9d2c4]')}>{seg}</span>
            </span>
          ))}
        </div>
      )}

      {/* Undo / Redo bar after an applied change */}
      {!activeDiff && activeTab && (canUndo || canRedo) && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#15130f] border-b border-[#2d2921] shrink-0">
          <span className="text-xs text-[#938a7c]">
            {canUndo ? `Change applied to ${activeTab.name}` : `Change undone in ${activeTab.name}`}
          </span>
          <div className="flex gap-1.5">
            {canUndo && (
              <button
                onClick={undoLastAccept}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-[#2a261f] hover:bg-[#2d2921] text-[#ece6da] rounded border border-[#2d2921]"
              >
                <Undo2 size={12} /> Undo
              </button>
            )}
            {canRedo && (
              <button
                onClick={redoLastUndo}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-[#2a261f] hover:bg-[#2d2921] text-[#ece6da] rounded border border-[#2d2921]"
              >
                <Redo2 size={12} /> Redo
              </button>
            )}
          </div>
        </div>
      )}

      {/* Apply / Decline bar for a proposed change */}
      {activeDiff && activeTab && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#15130f] border-b border-[#2d2921] shrink-0">
          <span className="text-xs text-[#938a7c]">Proposed change to {activeTab.name}</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => void applyPending(activeDiff.path)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[#f0a93b] hover:bg-[#f5b952] text-[#1a1407] rounded"
            >
              <Check size={12} /> Apply
            </button>
            <button
              onClick={() => declinePending(activeDiff.path)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[#2a261f] hover:bg-[#2d2921] text-[#ece6da] rounded border border-[#2d2921]"
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
          <div className="relative h-full">
            <InlineDiff original={activeDiff.original} modified={activeDiff.modified} path={activeDiff.path} />
            {!isCreatePending(activeDiff.path) && <ReviewBar path={activeDiff.path} />}
          </div>
        ) : (
          <Editor
            height="100%"
            // One Monaco model per file: each file keeps its own undo history
            path={activeTab.path}
            language={activeTab.language}
            value={activeTab.content}
            onMount={(editor) => {
              registerEditorActions(editor)
              attachEditorStatus(editor)
              setRevealEditor(editor)
            }}
            theme="spectrum-warm"
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