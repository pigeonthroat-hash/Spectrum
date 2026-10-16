import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Loader2, Sparkles, Check, X } from 'lucide-react'
import { ChatInput } from './ChatInput'
import { ToolBlock } from './ToolBlock'
import { runAgent } from '../lib/agent/runAgent'
import { plainText, type Block } from '../lib/agent/types'
import { errorText } from '../lib/errors'

// Only the last few messages are sent to the model, to keep requests small
const HISTORY_TURNS = 6

export function AISidebar() {
  const messages = useAppStore((s) => s.messages)
  const addMessage = useAppStore((s) => s.addMessage)
  const patchMessage = useAppStore((s) => s.patchMessage)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const setGenerating = useAppStore((s) => s.setGenerating)
  const selectedModel = useAppStore((s) => s.selectedModel)
  const setModel = useAppStore((s) => s.setModel)
  const mode = useAppStore((s) => s.mode)
  const setMode = useAppStore((s) => s.setMode)
  const pendingDiffs = useAppStore((s) => s.pendingDiffs)
  const acceptAllDiffs = useAppStore((s) => s.acceptAllDiffs)
  const rejectAllDiffs = useAppStore((s) => s.rejectAllDiffs)
  const activeTabPath = useAppStore((s) => s.activeTabPath)
  const openTabs = useAppStore((s) => s.openTabs)
  const chatStyle = useAppStore((s) => s.chatStyle)
  const projectId = useAppStore((s) => s.projectId)

  const [input, setInput] = useState('')
  const [useFile, setUseFile] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeFile = openTabs.find((t) => t.path === activeTabPath) ?? null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isGenerating) return
    setInput('')

    // Earlier turns as plain text only (tool rows are left out to save space)
    const history = messages.slice(-HISTORY_TURNS).map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.role === 'user' ? m.content : plainText(m.blocks) || m.content,
    })).filter((t) => t.content)

    addMessage({ role: 'user', content: text })
    const assistantId = addMessage({ role: 'assistant', content: '', blocks: [] })
    setGenerating(true)

    const setBlocks = (update: (blocks: Block[]) => Block[]) =>
      patchMessage(assistantId, (m) => {
        const blocks = update(m.blocks ?? [])
        return { ...m, blocks, content: plainText(blocks) }
      })

    try {
      await runAgent({
        projectId,
        modelId: selectedModel,
        mode,
        history,
        userText: text,
        activeFileName: useFile && activeFile ? activeFile.name : null,
        setBlocks,
      })
    } catch (err) {
      setBlocks((bs) => [...bs, { type: 'text', text: `[Error: ${errorText(err)}]` }])
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Pending changes bar */}
      {pendingDiffs.length > 0 && (
        <div className="px-3 py-2 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-[#8b949e]">
            {pendingDiffs.length} change{pendingDiffs.length > 1 ? 's' : ''} pending
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={acceptAllDiffs}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[#238636] hover:bg-[#2ea043] text-white rounded"
            >
              <Check size={12} /> Keep All
            </button>
            <button
              onClick={rejectAllDiffs}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] rounded border border-[#30363d]"
            >
              <X size={12} /> Undo All
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-[#8b949e]">
            <Sparkles size={28} className="text-[#e6edf3] opacity-70" />
            <p className="text-xs max-w-[220px]">
              Ask a question, plan a change, or debug an error. Browser models run on this computer, with no install
              needed.
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'user') {
            return (
              <div
                key={msg.id}
                className="rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2 text-sm text-[#e6edf3] whitespace-pre-wrap leading-relaxed"
              >
                {msg.content}
              </div>
            )
          }
          const pending = isGenerating && i === messages.length - 1
          const blocks: Block[] = msg.blocks?.length
            ? msg.blocks
            : msg.content
              ? [{ type: 'text', text: msg.content }]
              : []
          if (blocks.length === 0) {
            return pending ? <Loader2 key={msg.id} size={14} className="animate-spin text-[#8b949e]" /> : null
          }
          return (
            <div key={msg.id} className="space-y-2 text-sm text-[#e6edf3]">
              {blocks.map((b, j) =>
                b.type === 'text' ? (
                  b.text.trim() ? (
                    <div key={j} className="whitespace-pre-wrap leading-relaxed">
                      {b.text.trim()}
                    </div>
                  ) : null
                ) : (
                  <ToolBlock key={b.id} block={b} />
                )
              )}
              {pending && <Loader2 size={12} className="animate-spin text-[#8b949e]" />}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={isGenerating}
        mode={mode}
        onModeChange={setMode}
        style={chatStyle}
        fileName={activeFile?.name ?? null}
        useFile={useFile}
        onToggleFile={() => setUseFile((v) => !v)}
        selectedModel={selectedModel}
        onModelChange={setModel}
      />
    </div>
  )
}