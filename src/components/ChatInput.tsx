import type { KeyboardEvent } from 'react'
import { Send, RotateCcw } from 'lucide-react'
import { LiquidGlassBox } from './LiquidGlassBox'
import { cn } from '../lib/utils'
import type { ChatStyle } from '../store/useAppStore'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled: boolean
  mode: 'chat' | 'agent' | 'composer'
  style: ChatStyle
}

export function ChatInput({ value, onChange, onSend, disabled, mode, style }: ChatInputProps) {
  const placeholder =
    mode === 'chat'
      ? 'Ask about the code...'
      : mode === 'agent'
        ? 'Describe a task for the agent...'
        : 'Describe multi-file changes...'

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const isLiquid = style === 'liquid'

  const box = (
    <>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={3}
          className={cn(
            'w-full rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] placeholder:text-[#8b949e] resize-none outline-none pr-10',
            isLiquid
              ? 'bg-transparent'
              : 'bg-[#161b22] border border-[#30363d] focus:border-[#58a6ff]'
          )}
        />
        <button
          onClick={onSend}
          disabled={!value.trim() || disabled}
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
    </>
  )

  return (
    <div className="p-3 border-t border-[#30363d] shrink-0">
      {isLiquid ? <LiquidGlassBox>{box}</LiquidGlassBox> : box}
    </div>
  )
}
