import { useRef, type KeyboardEvent } from 'react'
import { AtSign, File, Plus, Send, X } from 'lucide-react'
import { LiquidGlassBox } from './LiquidGlassBox'
import { ModelPicker } from './ModelPicker'
import type { ChatStyle } from '../store/useAppStore'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled: boolean
  mode: 'chat' | 'agent' | 'composer'
  style: ChatStyle
  fileName: string | null
  useFile: boolean
  onToggleFile: () => void
  selectedModel: string
  onModelChange: (id: string) => void
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  mode,
  style,
  fileName,
  useFile,
  onToggleFile,
  selectedModel,
  onModelChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isLiquid = style === 'liquid'
  const showFile = useFile && fileName !== null

  const placeholder =
    mode === 'chat'
      ? 'Ask about the code (Enter to send)'
      : mode === 'agent'
        ? 'Describe a task for the agent'
        : 'Describe multi-file changes'

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const mention = () => {
    onChange(value && !value.endsWith(' ') ? `${value} @` : `${value}@`)
    textareaRef.current?.focus()
  }

  const content = (
    <div className="flex flex-col gap-2">
      {/* Top row: attach + current file chip */}
      <div className="flex items-center gap-1.5 min-h-[24px]">
        <button
          type="button"
          disabled
          title="Attachments (coming soon)"
          className="p-1 rounded-md text-[#8b949e] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
        </button>
        {showFile && (
          <span className="flex items-center gap-1.5 min-w-0 px-2 py-0.5 rounded-md bg-[#21262d] border border-[#30363d] text-xs text-[#e6edf3]">
            <File size={12} className="text-[#8b949e] shrink-0" />
            <span className="truncate max-w-[140px]">{fileName}</span>
            <span className="text-[10px] text-[#8b949e] shrink-0">Current File</span>
            <button type="button" onClick={onToggleFile} className="text-[#8b949e] hover:text-white shrink-0">
              <X size={11} />
            </button>
          </span>
        )}
      </div>

      {/* Text input */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={3}
        className="w-full bg-transparent text-sm text-[#e6edf3] placeholder:text-[#8b949e] resize-none outline-none"
      />

      {/* Bottom row: model, mention, context, send */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-[#8b949e]">
        <div className="flex items-center gap-2 min-w-0">
          <ModelPicker value={selectedModel} onChange={onModelChange} placement="up" />
          <button type="button" onClick={mention} className="flex items-center gap-1 hover:text-white shrink-0">
            <AtSign size={11} /> Mention
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={onToggleFile} className="hover:text-white">
            {useFile ? 'current file' : 'no context'}
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={!value.trim() || disabled}
            className="p-1.5 rounded-md bg-[#238636] hover:bg-[#2ea043] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-3 border-t border-[#30363d] shrink-0">
      {isLiquid ? (
        <LiquidGlassBox>{content}</LiquidGlassBox>
      ) : (
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-2.5">{content}</div>
      )}
    </div>
  )
}
