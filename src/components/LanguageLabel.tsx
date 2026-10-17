import { useAppStore } from '../store/useAppStore'
import { languageLabel } from '../lib/languages'

// Status bar label: the language of the file that is open
export function LanguageLabel() {
  const language = useAppStore(
    (s) => s.openTabs.find((t) => t.path === s.activeTabPath)?.language ?? 'plaintext'
  )
  return <span>{languageLabel(language)}</span>
}