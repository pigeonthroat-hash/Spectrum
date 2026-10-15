import { useEffect, useRef, type KeyboardEvent } from 'react'
import { AtSign, File, Image as ImageIcon, Plus, Send, X } from 'lucide-react'
import { LiquidGlassBox } from './LiquidGlassBox'
import { ModelPicker } from './ModelPicker'
import { ModePicker } from './ModePicker'
import type { AgentMode, ChatStyle } from '../store/useAppStore'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled: boolean
  mode: AgentMode
  onModeChange: (mode: AgentMode) => void
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
  onModeChange,
  style,
  fileName,
  useFile,
  onToggleFile,
  selectedModel,
  onModelChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isLiquid = style === 'liquid'
  const hasFile = fileName !== null

  // One line that grows with the text, up to a cap
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [value])

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
    <div className="flex flex-col gap-1.5">
      {/* Top row: attach + current file chip */}
      <div className="flex items-center gap-1.5 min-h-[22px]">
        <button
          type="button"
          disabled
          title="Attachments (coming soon)"
          className="p-0.5 rounded text-[#8b949e] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
        </button>
        {hasFile && useFile && (
          <span className="flex items-center gap-1.5 min-w-0 px-2 py-0.5 rounded-md bg-[#21262d] border border-[#30363d] text-xs text-[#e6edf3]">
            <File size={12} className="text-[#8b949e] shrink-0" />
            <span className="truncate max-w-[140px]">{fileName}</span>
            <span className="text-[10px] text-[#8b949e] shrink-0">Current File</span>
            <button type="button" onClick={onToggleFile} className="text-[#8b949e] hover:text-white shrink-0">
              <X size={11} />
            </button>
          </span>
        )}
        {hasFile && !useFile && (
          <button
            type="button"
            onClick={onToggleFile}
            className="px-2 py-0.5 rounded-md border border-dashed border-[#30363d] text-xs text-[#8b949e] hover:text-white"
          >
            + Current File
          </button>
        )}
      </div>

      {/* Text input */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Plan, @ for context, / for commands"
        rows={1}
        className="w-full bg-transparent text-sm leading-5 text-[#e6edf3] placeholder:text-[#8b949e] resize-none outline-none"
      />

      {/* Bottom row: mode + model on the left, actions on the right */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-[#8b949e]">
        <div className="flex items-center gap-1 min-w-0">
          <ModePicker value={mode} onChange={onModeChange} placement="up" />
          <ModelPicker value={selectedModel} onChange={onModelChange} placement="up" />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={mention} title="Mention" className="p-1 rounded hover:text-white hover:bg-[#21262d]">
            <AtSign size={13} />
          </button>
          <button type="button" disabled title="Images (coming soon)" className="p-1 rounded disabled:opacity-50">
            <ImageIcon size={13} />
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={!value.trim() || disabled}
            className="p-1.5 rounded-md bg-[#e6edf3] text-[#0d1117] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-2 border-t border-[#30363d] shrink-0">
      {isLiquid ? (
        <LiquidGlassBox>{content}</LiquidGlassBox>
      ) : (
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] px-2.5 py-2">{content}</div>
      )}
    </div>
  )
}
