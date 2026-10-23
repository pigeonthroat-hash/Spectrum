import { useEffect, useState } from 'react'
import { AlertTriangle, Bell, XCircle } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useGroqUsage } from '../lib/providers/groqUsage'
import { useEditorStatus } from '../lib/editor/status'
import { LanguageLabel } from './LanguageLabel'
import { FolderMenu } from './FolderMenu'

const SAVE_LABEL: Record<string, string> = {
  idle: 'Ready',
  saving: 'Saving...',
  saved: 'Saved to cloud',
  error: 'Save failed',
}

// Errors and warnings Monaco reports across open files, refreshed every second and a half
function useProblemCounts() {
  const [counts, setCounts] = useState({ errors: 0, warnings: 0 })
  useEffect(() => {
    const read = () => {
      const monaco = (window as unknown as { monaco?: { editor: { getModelMarkers: (f: object) => { severity: number }[] } } }).monaco
      if (!monaco) return
      const markers = monaco.editor.getModelMarkers({})
      setCounts({
        errors: markers.filter((m) => m.severity === 8).length,
        warnings: markers.filter((m) => m.severity === 4).length,
      })
    }
    read()
    const id = window.setInterval(read, 1500)
    return () => window.clearInterval(id)
  }, [])
  return counts
}

// Bottom bar: problems and save state on the left, cursor and file details on the right
export function StatusBar() {
  const saveStatus = useAppStore((s) => s.saveStatus)
  const activeTabPath = useAppStore((s) => s.activeTabPath)
  const remaining = useGroqUsage((s) => s.remaining)
  const { errors, warnings } = useProblemCounts()
  const { line, column, tabSize, eol } = useEditorStatus()

  return (
    <footer className="h-6 flex items-center justify-between px-2 border-t border-[#2d2921] bg-[#15130f] text-[11px] text-[#938a7c] shrink-0 select-none">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex items-center gap-1" title="Errors and warnings">
          <XCircle size={11} />
          {errors}
          <AlertTriangle size={11} className="ml-1" />
          {warnings}
        </span>
        <span>{SAVE_LABEL[saveStatus]}</span>
        {remaining !== null && <span>Groq requests left today: {remaining}</span>}
        <span className="hidden md:inline text-[#f0a93b]">● Free models enabled</span>
      </div>
      <div className="hidden md:flex items-center gap-3">
        {activeTabPath && (
          <>
            <span>Ln {line}, Col {column}</span>
            <span>Spaces: {tabSize}</span>
          </>
        )}
        <span>UTF-8</span>
        {activeTabPath && <span>{eol}</span>}
        <LanguageLabel />
        <span title="Notifications (coming later)" className="opacity-50">
          <Bell size={11} />
        </span>
        <FolderMenu />
      </div>
    </footer>
  )
}