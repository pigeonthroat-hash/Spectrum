import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Loader2, Sparkles, Check, X, File, Square } from 'lucide-react'
import { ChatInput } from './ChatInput'
import { ToolBlock } from './ToolBlock'
import { runAgent } from '../lib/agent/runAgent'
import { plainText, type Block } from '../lib/agent/types'
import { errorText } from '../lib/errors'
import { listPaths } from '../lib/agent/tools'
import { storageFor } from '../lib/storage/active'
import { MessageContent } from './MessageContent'
import { LOCAL_MODELS, GROQ_MODELS } from '../lib/models'

// Only the last few messages are sent to the model, to keep requests small
const HISTORY_TURNS = 6

// Files mentioned with @ are read and added to what the model sees (the chat bubble still shows only the typed text)
const MAX_MENTIONED_FILES = 3
const MAX_MENTIONED_CHARS = 8000

async function attachMentions(text: string, projectId: string | null): Promise<string> {
  if (!projectId) return text
  const mentioned = [...new Set([...text.matchAll(/(?:^|\s)@([^\s@]+)/g)].map((m) => m[1]))]
  if (mentioned.length === 0) return text
  const known = new Set(await listPaths(projectId))
  const storage = storageFor(projectId)
  const parts: string[] = []
  for (const path of mentioned.filter((p) => known.has(p)).slice(0, MAX_MENTIONED_FILES)) {
    try {
      const content = await storage.readFile(path)
      parts.push(`File ${path}:\n${content.slice(0, MAX_MENTIONED_CHARS)}`)
    } catch {
      // A file that can't be read is skipped
    }
  }
  return parts.length ? `${text}\n\n${parts.join('\n\n')}` : text
}

// Turns technical errors into a message the user can act on
function friendlyError(err: unknown): string {
  const raw = errorText(err)
  if (/ollama/i.test(raw) && /reach|connect|fetch/i.test(raw)) {
    return "Ollama isn't running. Start Ollama, or pick a Groq model."
  }
  if (/device lost|mapAsync|Instance reference|GPU/i.test(raw)) {
    return 'The browser lost its graphics connection while the model was running. This usually means the model is too big for this computer. Try a smaller model, or a Groq model.'
  }
  if (/out of memory|OOM/i.test(raw)) {
    return 'This computer ran out of memory for the model. Close other apps, or pick a smaller model.'
  }
  if (/quota/i.test(raw)) {
    return 'Not enough browser storage for this model. Free up disk space, or pick a smaller model.'
  }
  return raw
}

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
  const [filePaths, setFilePaths] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Controller for the reply in progress; Stop calls abort() on it
  const abortRef = useRef<AbortController | null>(null)

  const activeFile = openTabs.find((t) => t.path === activeTabPath) ?? null

  // A saved model that is no longer in the list is replaced with a working Groq model
  useEffect(() => {
    const knownLocal = LOCAL_MODELS.some((m) => m.id === selectedModel)
    const knownGroq = GROQ_MODELS.some((m) => m.id === selectedModel)
    if ((selectedModel.startsWith('browser/') && !knownLocal) || (selectedModel.startsWith('groq/') && !knownGroq)) {
      setModel(GROQ_MODELS[0].id)
    }
  }, [selectedModel, setModel])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Refresh the file list for the @ menu when the project or the chat changes (the agent may have created files)
  useEffect(() => {
    if (!projectId) {
      setFilePaths([])
      return
    }
    listPaths(projectId).then(setFilePaths).catch(() => setFilePaths([]))
  }, [projectId, messages.length])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isGenerating) return
    setInput('')

    // Earlier turns as plain text only (tool rows are left out to save space)
    const history = messages.slice(-HISTORY_TURNS).map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.role === 'user' ? m.content : plainText(m.blocks) || m.content,
    })).filter((t) => t.content)

    addMessage({
      role: 'user',
      content: text,
      fileName: useFile && activeFile ? activeFile.name : undefined,
    })
    const assistantId = addMessage({ role: 'assistant', content: '', blocks: [] })
    setGenerating(true)

    const setBlocks = (update: (blocks: Block[]) => Block[]) =>
      patchMessage(assistantId, (m) => {
        const blocks = update(m.blocks ?? [])
        return { ...m, blocks, content: plainText(blocks) }
      })

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await runAgent({
        projectId,
        modelId: selectedModel,
        mode,
        history,
        userText: await attachMentions(text, projectId),
        activeFileName: useFile && activeFile ? activeFile.name : null,
        setBlocks,
        signal: controller.signal,
      })
      if (controller.signal.aborted) {
        setBlocks((bs) => [...bs, { type: 'text', text: '[Stopped]' }])
      }
    } catch (err) {
      setBlocks((bs) => [...bs, { type: 'text', text: `[Error: ${friendlyError(err)}]` }])
    } finally {
      abortRef.current = null
      setGenerating(false)
    }
  }

  const stopGenerating = () => abortRef.current?.abort()

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
            {selectedModel.startsWith('groq/') && (
              <p className="text-[11px] max-w-[240px] text-[#8b949e]">
                Groq models are run by Groq. Your messages and any @-mentioned files are sent to Groq to generate
                replies.
              </p>
            )}
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'user') {
            return (
              <div
                key={msg.id}
                className="rounded-md border border-[#30363d] bg-[#1c2128] px-3 py-2.5 text-sm text-[#e6edf3] whitespace-pre-wrap leading-relaxed"
              >
                {msg.fileName && (
                  <span className="mb-2 inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-[#30363d]/60 text-xs text-[#c9d1d9]">
                    <File size={11} className="text-[#8b949e]" />
                    {msg.fileName}
                    <span className="text-[#8b949e]">Current File</span>
                  </span>
                )}
                <div>{msg.content}</div>
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
                    <MessageContent key={j} text={b.text.trim()} />
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

      {/* Stop bar, shown while a reply is being written */}
      {isGenerating && (
        <div className="px-3 py-1.5 border-t border-[#30363d] flex items-center justify-between text-xs text-[#8b949e] shrink-0">
          <span className="flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" /> Working...
          </span>
          <button
            type="button"
            onClick={stopGenerating}
            className="flex items-center gap-1 px-2 py-1 rounded border border-[#30363d] bg-[#21262d] text-[#e6edf3] hover:bg-[#30363d]"
          >
            <Square size={11} /> Stop
          </button>
        </div>
      )}

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
        filePaths={filePaths}
      />
    </div>
  )
}