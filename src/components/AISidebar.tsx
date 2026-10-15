import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Bot, User, Loader2, Sparkles, Check, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { ChatInput } from './ChatInput'
import { streamOllamaChat, type ChatMessage } from '../lib/providers/ollama'

const MAX_CONTEXT_CHARS = 12000

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
    let content =
      'You are Spectrum, a coding assistant inside a code editor. Be concise and practical. Use code blocks for code.'
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
      if (!selectedModel.startsWith('ollama/')) {
        throw new Error('Only local Ollama models are connected so far. Pick one of the "local" models.')
      }
      await streamOllamaChat({
        model: selectedModel,
        messages: prompt,
        onToken: (token) => updateMessage(assistantId, (prev) => prev + token),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      updateMessage(assistantId, (prev) => (prev ? `${prev}\n\n[Error: ${msg}]` : `[Error: ${msg}]`))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#0d1117] border-l border-[#30363d]">
      {/* Header: mode tabs */}
      <div className="flex items-center px-3 py-2 border-b border-[#30363d] shrink-0">
        <div className="flex gap-1">
          {(['chat', 'agent', 'composer'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded capitalize transition-colors',
                mode === m
                  ? 'bg-[#21262d] text-white'
                  : 'text-[#8b949e] hover:text-white hover:bg-[#161b22]'
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Pending diffs bar */}
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
              <Check size={12} /> Accept all
            </button>
            <button
              onClick={rejectAllDiffs}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] rounded border border-[#30363d]"
            >
              <X size={12} /> Reject
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-[#8b949e]">
            <Sparkles size={32} className="text-[#3fb950] opacity-80" />
            <div>
              <p className="text-sm font-medium text-[#e6edf3]">Spectrum Agent</p>
              <p className="text-xs mt-1 max-w-[220px]">
                Ask anything. Local models run through Ollama on your machine.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex gap-2.5 text-sm', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-[#238636] flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={14} className="text-white" />
              </div>
            )}
            <div
              className={cn(
                'rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap leading-relaxed',
                msg.role === 'user'
                  ? 'bg-[#238636] text-white'
                  : 'bg-[#161b22] text-[#e6edf3] border border-[#30363d]'
              )}
            >
              {msg.content || <Loader2 size={14} className="animate-spin text-[#8b949e]" />}
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-[#30363d] flex items-center justify-center shrink-0 mt-0.5">
                <User size={14} className="text-[#e6edf3]" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={isGenerating}
        mode={mode}
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
