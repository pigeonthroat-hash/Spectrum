import { useAttachments } from '../lib/chat/attachments'
import { useToolToggles } from '../lib/tools/toggles'
import { TOOLS } from '../lib/tools/registry'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { AtSign, File, Image as ImageIcon, Plus, Send, X } from 'lucide-react'
import { ModelPicker } from './ModelPicker'
import { ModePicker } from './ModePicker'
import { MicButton } from './MicButton'
import { MentionMenu, type MenuView } from './MentionMenu'
import type { AgentMode } from '../store/useAppStore'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled: boolean
  mode: AgentMode
  onModeChange: (mode: AgentMode) => void
  askOnly?: boolean
  fileName: string | null
  useFile: boolean
  onToggleFile: () => void
  selectedModel: string
  onModelChange: (id: string) => void
  filePaths: string[]
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  mode,
  onModeChange,
  askOnly,
  fileName,
  useFile,
  onToggleFile,
  selectedModel,
  onModelChange,
  filePaths,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasFile = fileName !== null
  const [highlight, setHighlight] = useState(0)
  const [menuView, setMenuView] = useState<MenuView>('root')
  const enabledTools = useToolToggles((s) => s.enabled)
  const attached = useAttachments((s) => s.files)
  const attachFile = useAttachments((s) => s.add)
  const detachFile = useAttachments((s) => s.remove)
  const toggleTool = useToolToggles((s) => s.toggle)

  // An "@" starts a mention when it is at the start or after a space.
  // The text after it is the search.
  const mention = value.match(/(?:^|\s)@([^\s@]*)$/)
  const query = mention ? mention[1] : null
  const matches =
    query === null
      ? []
      : filePaths.filter((p) => p.toLowerCase().includes(query.toLowerCase())).slice(0, 50)
  const menuOpen = query !== null
  const optionalTools = TOOLS.filter((t) => t.optional)
  // Arrow keys and Enter pick files only where the file list is showing
  const filesNavigable = menuOpen && (menuView === 'files' || (menuView === 'root' && query !== ''))

  useEffect(() => {
    setHighlight(0)
  }, [query])

  // One line that grows with the text, up to a cap
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [value])

  // Picking a file removes the @ text and adds the file as a chip
  const pickFile = (path: string) => {
    if (query === null) return
    onChange(value.slice(0, value.length - query.length - 1))
    attachFile(path)
    setMenuView('root')
    textareaRef.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (filesNavigable && matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) => (h + 1) % matches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) => (h - 1 + matches.length) % matches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        pickFile(matches[highlight])
        return
      }
    }
    if (menuOpen && e.key === 'Escape' && query !== null) {
      e.preventDefault()
      onChange(value.slice(0, value.length - query.length - 1))
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const mentionClick = () => {
    onChange(value && !value.endsWith(' ') ? `${value} @` : `${value}@`)
    textareaRef.current?.focus()
  }

  const content = (
    <div className="flex flex-col gap-1">
      {/* Top row: the + button, plus chips. The empty space here is the drag handle for the box. */}
      <div data-drag-handle className="flex flex-wrap items-center gap-1.5 min-h-[22px] cursor-grab">
        <button type="button" disabled title="Attachments (coming soon)" className="p-0.5 rounded text-[#938a7c] disabled:opacity-50 disabled:cursor-not-allowed">
          <Plus size={14} />
        </button>
          {hasFile && useFile && (
            <span className="flex items-center gap-1.5 min-w-0 px-2 py-0.5 rounded-md bg-[#2a261f] border border-[#2d2921] text-xs text-[#ece6da]">
              <File size={12} className="text-[#938a7c] shrink-0" />
              <span className="truncate max-w-[140px]">{fileName}</span>
              <span className="text-[10px] text-[#938a7c] shrink-0">Current File</span>
              <button type="button" onClick={onToggleFile} className="text-[#938a7c] hover:text-white shrink-0">
                <X size={11} />
              </button>
            </span>
          )}
          {hasFile && !useFile && (
            <button
              type="button"
              onClick={onToggleFile}
              className="px-1.5 py-0.5 rounded border border-dashed border-[#2d2921] text-xs text-[#938a7c] hover:text-white"
            >
              + Current File
            </button>
          )}
          {attached.map((path) => (
            <span
              key={'file-' + path}
              className="anim-scale-in flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#2a261f] border border-[#2d2921] text-xs text-[#ece6da]"
            >
              <File size={11} className="text-[#938a7c] shrink-0" />
              <span className="truncate max-w-[160px]">{path.split('/').pop()}</span>
              <button type="button" onClick={() => detachFile(path)} title="Remove" className="text-[#938a7c] hover:text-white">
                <X size={10} />
              </button>
            </span>
          ))}
          {enabledTools.map((name) => (
            <span
              key={'tool-' + name}
              className="anim-scale-in flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#2a261f] border border-[#2d2921] text-[11px] text-[#d9d2c4]"
            >
              {name}
              <button type="button" onClick={() => toggleTool(name)} title="Turn off" className="text-[#938a7c] hover:text-white">
                <X size={10} />
              </button>
            </span>
          ))}
      </div>

      {/* Text input */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Plan, search, build anything"
        rows={1}
        className="w-full min-h-[20px] bg-transparent text-sm leading-5 text-[#ece6da] placeholder:text-[#938a7c] resize-none outline-none"
      />

      {/* Bottom row, like Cursor: mode and model on the left, @, image, and send on the right */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <ModePicker value={mode} onChange={onModeChange} placement="up" askOnly={askOnly} />
          <ModelPicker value={selectedModel} onChange={onModelChange} placement="up" />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={mentionClick}
            title="Add context (@)"
            className="flex items-center gap-1 px-1.5 py-1 rounded-md text-xs text-[#938a7c] hover:text-white hover:bg-[#2a261f]"
          >
            <Plus size={12} />
            Add Context
          </button>
          <button type="button" onClick={mentionClick} title="Mention" className="p-1.5 rounded-md text-[#938a7c] hover:text-white hover:bg-[#2a261f]">
            <AtSign size={14} />
          </button>
          <MicButton value={value} onChange={onChange} />
          <button type="button" disabled title="Images (coming soon)" className="p-1.5 rounded-md text-[#938a7c] disabled:opacity-40">
            <ImageIcon size={14} />
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={(!value.trim() && attached.length === 0) || disabled}
            title="Send"
            className="ml-0.5 h-7 w-7 flex items-center justify-center rounded-full bg-[#f0a93b] text-[#1f1b15] hover:bg-white disabled:bg-[#3a342a] disabled:text-[#938a7c] transition-colors"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="relative">
      {menuOpen && (
        <MentionMenu
          view={menuView}
          setView={setMenuView}
          query={query ?? ''}
          files={matches}
          highlight={highlight}
          onPick={pickFile}
          onHover={setHighlight}
          optionalTools={optionalTools}
          enabled={enabledTools}
          onToggleTool={toggleTool}
        />
      )}
      {content}
    </div>
  )
}