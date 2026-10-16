import { useState, useRef, useEffect } from 'react'
import { useAppStore, type AgentMode } from '../store/useAppStore'
import { Loader2, Sparkles, Check, X } from 'lucide-react'
import { ChatInput } from './ChatInput'
import { streamOllamaChat, type ChatMessage } from '../lib/providers/ollama'
import { streamBrowserAI } from '../lib/ai/webllm'

const MAX_CONTEXT_CHARS = 12000

const BASE_PROMPT =
  'You are Spectrum, a coding assistant inside a code editor. Be concise and practical. Use code blocks for code.'

const MODE_PROMPTS: Record<AgentMode, string> = {
  agent: 'Help the user complete the task. Show the code changes you would make.',
  plan: 'Break the task into a short numbered plan before writing any code.',
  debug: 'Find the most likely root cause of the problem, explain why, then suggest a minimal fix.',
  ask: 'Answer the question clearly. Do not propose file edits.',
}

export function AISidebar() {
  const {
    messages,
    addMessage,
    updateMessage,
    isGenerating,
    setGenerating,
    selectedModel,
    setModel,
    mode,
    setMode,
    pendingDiffs,
    acceptAllDiffs,
    rejectAllDiffs,
    activeTabPath,
    openTabs,
    chatStyle,
  } = useAppStore()

  const [input, setInput] = useState('')
  const [useFile, setUseFile] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeFile = openTabs.find((t) => t.path === activeTabPath) ?? null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const buildSystemPrompt = (): ChatMessage => {
    let content = `${BASE_PROMPT}\n\nMode: ${MODE_PROMPTS[mode]}`
    if (useFile && activeFile) {
      content += `\n\nThe user has this file open: ${activeFile.name}\n\`\`\`\n${activeFile.content.slice(0, MAX_CONTEXT_CHARS)}\n\`\`\``
    }
    return { role: 'system', content }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isGenerating) return
    setInput('')

    const history: ChatMessage[] = messages
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }))
    const prompt: ChatMessage[] = [buildSystemPrompt(), ...history, { role: 'user', content: text }]

    addMessage({ role: 'user', content: text })
    const assistantId = addMessage({ role: 'assistant', content: '' })
    setGenerating(true)

    try {
      const onToken = (token: string) => updateMessage(assistantId, (prev) => prev + token)
      if (selectedModel.startsWith('browser/')) {
        await streamBrowserAI({
          modelId: selectedModel.slice('browser/'.length),
          messages: prompt,
          onToken,
        })
      } else if (selectedModel.startsWith('ollama/')) {
        await streamOllamaChat({ model: selectedModel, messages: prompt, onToken })
      } else {
        throw new Error('This model is not connected yet. Pick a browser or Ollama model.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      updateMessage(assistantId, (prev) => (prev ? `${prev}\n\n[Error: ${msg}]` : `[Error: ${msg}]`))
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
              Ask a question, plan a change, or debug an error. Browser models run on this computer, with no install needed.
            </p>
          </div>
        )}

        {messages.map((msg) =>
          msg.role === 'user' ? (
            <div
              key={msg.id}
              className="rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2 text-sm text-[#e6edf3] whitespace-pre-wrap leading-relaxed"
            >
              {msg.content}
            </div>
          ) : (
            <div key={msg.id} className="text-sm text-[#e6edf3] whitespace-pre-wrap leading-relaxed">
              {msg.content || <Loader2 size={14} className="animate-spin text-[#8b949e]" />}
            </div>
          )
        )}
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