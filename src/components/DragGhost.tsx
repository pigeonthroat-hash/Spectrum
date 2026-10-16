import { File, Folder } from 'lucide-react'
import { useDragStore } from '../lib/dragStore'

// Small label that follows the pointer while dragging
export function DragGhost() {
  const item = useDragStore((s) => s.item)
  const x = useDragStore((s) => s.x)
  const y = useDragStore((s) => s.y)
  if (!item) return null

  const label = item.kind === 'file' ? item.name : item.label
  return (
    <div
      className="pointer-events-none fixed z-[100] flex items-center gap-1.5 px-2 py-1 rounded-md border border-[#30363d] bg-[#21262d] text-xs text-[#e6edf3] shadow-lg"
      style={{ left: x + 12, top: y + 10 }}
    >
      {item.kind === 'file' &&
        (item.isFolder ? <Folder size={12} className="text-[#58a6ff]" /> : <File size={12} className="text-[#8b949e]" />)}
      <span>{label}</span>
    </div>
  )
}