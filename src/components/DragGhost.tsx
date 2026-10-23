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
      className="pointer-events-none fixed z-[100] flex items-center gap-1.5 px-2 py-1 rounded-md border border-[#2d2921] bg-[#2a261f] text-xs text-[#ece6da] shadow-lg"
      style={{ left: x + 12, top: y + 10 }}
    >
      {item.kind === 'file' &&
        (item.isFolder ? <Folder size={12} className="text-[#f0a93b]" /> : <File size={12} className="text-[#938a7c]" />)}
      <span>{label}</span>
    </div>
  )
}