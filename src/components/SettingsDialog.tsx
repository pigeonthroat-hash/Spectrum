import { X } from 'lucide-react'
import { useAppStore, type ChatStyle } from '../store/useAppStore'
import { cn } from '../lib/utils'

const CHAT_STYLES: { value: ChatStyle; label: string; desc: string }[] = [
  { value: 'classic', label: 'Classic', desc: 'Flat dark input box (default)' },
  { value: 'liquid', label: 'Liquid glass', desc: 'Glass effect on the chat box only' },
]

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const chatStyle = useAppStore((s) => s.chatStyle)
  const setChatStyle = useAppStore((s) => s.setChatStyle)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={onClose}
    >
      <div
        className="w-[420px] max-w-[90vw] bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
          <span className="text-sm font-semibold">Settings</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#21262d] text-[#8b949e]">
            <X size={14} />
          </button>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8b949e] mb-2">
            Chat box style
          </p>
          <div className="space-y-2">
            {CHAT_STYLES.map((o) => (
              <button
                key={o.value}
                onClick={() => setChatStyle(o.value)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded border text-xs',
                  chatStyle === o.value
                    ? 'border-[#58a6ff] bg-[#21262d]'
                    : 'border-[#30363d] hover:bg-[#21262d]'
                )}
              >
                <span className="block text-sm text-[#e6edf3]">{o.label}</span>
                <span className="block text-[#8b949e]">{o.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
