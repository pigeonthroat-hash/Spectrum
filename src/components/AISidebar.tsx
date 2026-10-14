import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Send, Bot, User, Loader2, Sparkles, Check, X, RotateCcw } from 'lucide-react'
import { cn } from '../lib/utils'

const MODELS = [
  { id: 'ollama/gemma2:9b', label: 'Gemma 2 9B (local)' },
  { id: 'ollama/gemma2:27b', label: 'Gemma 2 27B (local)' },
  { id: 'ollama/qwen2.5-coder:7b', label: 'Qwen2.5-Coder 7B' },
  { id: 'ollama/deepseek-coder-v2:16b', label: 'DeepSeek Coder V2' },
  { id: 'groq/llama-3.3-70b', label: 'Llama 3.3 70B (Groq)' },
  { id: 'openrouter/google/gemma-2-9b-it', label: 'Gemma 2 9B (OpenRouter)' },
]

export function AISidebar() {
  const {
    messages,
    addMessage,
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
  } = useAppStore()

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return
    const userMsg = input.trim()
    setInput('')
    addMessage({ role: 'user', content: userMsg })
    setGenerating(true)

    // Simulated AI response for scaffolding (real provider later)
    setTimeout(() => {
      const active = openTabs.find((t) => t.path === activeTabPath)
      let reply = `I'll help with that using **${selectedModel}**.\n\n`

      if (mode === 'agent' || mode === 'composer') {
        reply += `Analyzing the request: "${userMsg}"\n\n`
        if (active) {
          reply += `Looking at \`${active.name}\`...\n\n`
          // Demo diff
          const original = active.content
          const modified = original + `\n\n// AI suggested addition for: ${userMsg}\nfunction aiHelper() {\n  console.log("Enhanced by Spectrum");\n}\n`
          useAppStore.getState().setPendingDiffs([
            {
              path: active.path,
              original,
              modified,
            },
          ])
          reply += `I've prepared a change. Review the green (additions) / red (deletions) in the editor and Accept or Reject.`
        } else {
          reply += `Open a file first so I can propose precise edits.`
        }
      } else {
        reply += `This is a chat reply. In Agent/Composer mode I can edit files across the workspace.\n\nFree models (Gemma, Qwen, DeepSeek via Ollama) will be fully wired next.`
      }

      addMessage({ role: 'assistant', content: reply })
      setGenerating(false)
    }, 900)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#0d1117] border-l border-[#30363d]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] shrink-0">
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
        <select
          value={selectedModel}
          onChange={(e) => setModel(e.target.value)}
          className="bg-[#161b22] border border-[#30363d] text-xs text-[#e6edf3] rounded px-2 py-1 max-w-[160px] outline-none focus:border-[#58a6ff]"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
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
                Ask anything, or switch to Agent/Composer to edit files with free models.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex gap-2.5 text-sm',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
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
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-[#30363d] flex items-center justify-center shrink-0 mt-0.5">
                <User size={14} className="text-[#e6edf3]" />
              </div>
            )}
          </div>
        ))}

        {isGenerating && (
          <div className="flex gap-2.5 items-center text-[#8b949e] text-sm">
            <div className="w-6 h-6 rounded-full bg-[#238636] flex items-center justify-center">
              <Loader2 size={14} className="text-white animate-spin" />
            </div>
            <span>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#30363d] shrink-0">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'chat'
                ? 'Ask about the code...'
                : mode === 'agent'
                  ? 'Describe a task for the agent...'
                  : 'Describe multi-file changes...'
            }
            rows={3}
            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] placeholder:text-[#8b949e] resize-none outline-none focus:border-[#58a6ff] pr-10"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            className="absolute right-2 bottom-2 p-1.5 rounded-md bg-[#238636] hover:bg-[#2ea043] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10px] text-[#8b949e]">
          <span>Enter to send · Shift+Enter newline</span>
          <span className="flex items-center gap-1">
            <RotateCcw size={10} /> Free models ready
          </span>
        </div>
      </div>
    </div>
  )
}
