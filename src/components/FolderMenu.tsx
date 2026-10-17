import { useEffect } from 'react'
import { useFolderMenu } from '../lib/run/menuStore'
import { runProject } from '../lib/run/runActive'

// Right-click menu for a folder in the file explorer
export function FolderMenu() {
  const menu = useFolderMenu((s) => s.menu)
  const close = useFolderMenu((s) => s.close)

  // Clicking anywhere else, or pressing a key, closes the menu
  useEffect(() => {
    if (!menu) return
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', close)
    }
  }, [menu, close])

  if (!menu) return null
  return (
    <div
      className="fixed z-50 min-w-[180px] rounded-md border border-[#30363d] bg-[#161b22] shadow-xl py-1 text-xs"
      style={{ left: menu.x, top: menu.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="w-full text-left px-3 py-1.5 text-[#e6edf3] hover:bg-[#21262d]"
        onClick={() => {
          const folder = menu.path
          close()
          void runProject(folder)
        }}
      >
        Run Project
      </button>
    </div>
  )
}