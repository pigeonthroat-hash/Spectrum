import { useEffect, useState } from 'react'
import { X, Settings, Boxes, Brain, LogOut, Trash2 } from 'lucide-react'
import { useAppStore, type ChatStyle } from '../store/useAppStore'
import { cn } from '../lib/utils'
import { BrowserModelsSection } from './BrowserModelsSection'
import { LOCAL_MODELS, GROQ_MODELS } from '../lib/models'
import { getForever, setForever } from '../lib/agent/autoApply'
import { getRunForever, setRunForever } from '../lib/agent/runApproval'
import { loadMemory, removeMemory, replaceMemory } from '../lib/agent/memory'
import { Pencil, Check as CheckIcon, X as XIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Tab = 'general' | 'models' | 'memory'

const TABS: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'models', label: 'Models', icon: Boxes },
  { id: 'memory', label: 'Memory', icon: Brain },
]

const CHAT_STYLES: { value: ChatStyle; label: string; desc: string }[] = [
  { value: 'classic', label: 'Classic', desc: 'Flat dark input box (default)' },
  { value: 'liquid', label: 'Liquid glass', desc: 'Glass effect on the chat box only' },
]

const sectionTitle = 'text-sm font-semibold text-[#e6edf3]'
const sectionText = 'text-xs text-[#8b949e] mt-1'

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('general')
  const [email, setEmail] = useState<string | null>(null)
  const [forever, setForeverState] = useState(false)
  const [runForever, setRunForeverState] = useState(false)
  const [notes, setNotes] = useState<string[]>([])

  const chatStyle = useAppStore((s) => s.chatStyle)
  const setChatStyle = useAppStore((s) => s.setChatStyle)
  const selectedModel = useAppStore((s) => s.selectedModel)
  const setModel = useAppStore((s) => s.setModel)
  const projectId = useAppStore((s) => s.projectId)

  // Read the current values each time the dialog opens
  useEffect(() => {
    if (!open) return
    setForeverState(getForever())
    setRunForeverState(getRunForever())
    setNotes(projectId ? loadMemory(projectId) : [])
    void supabase?.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null))
  }, [open, projectId])

  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')

  if (!open) return null

  const toggleForever = () => {
    setForever(!forever)
    setForeverState(!forever)
  }

  const toggleRunForever = () => {
    setRunForever(!runForever)
    setRunForeverState(!runForever)
  }

  const signOut = async () => {
    await supabase?.auth.signOut()
    setEmail(null)
  }

  const saveEdit = (note: string) => {
    if (!projectId) return
    try {
      replaceMemory(projectId, note, draft)
    } catch {
      return
    }
    setEditing(null)
    setNotes(loadMemory(projectId))
  }

  const deleteNote = (note: string) => {
    if (!projectId) return
    removeMemory(projectId, note)
    setNotes(loadMemory(projectId))
  }

  return (
    <div className="anim-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50" onMouseDown={onClose}>
      <div
        className="anim-pop w-[640px] max-w-[94vw] h-[460px] max-h-[88vh] flex flex-col bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#30363d]">
          <span className="text-sm font-semibold text-[#e6edf3]">Settings</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#21262d] text-[#8b949e]">
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left menu */}
          <nav className="w-40 shrink-0 border-r border-[#30363d] p-2 space-y-0.5">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-sm text-left',
                    tab === t.id ? 'bg-[#21262d] text-[#e6edf3]' : 'text-[#8b949e] hover:bg-[#21262d]'
                  )}
                >
                  <Icon size={14} /> {t.label}
                </button>
              )
            })}
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0 overflow-y-auto p-5 space-y-6">
            {tab === 'general' && (
              <>
                <section>
                  <p className={sectionTitle}>Account</p>
                  <p className={sectionText}>
                    {email ? (
                      <>
                        Signed in as <span className="text-[#e6edf3]">{email}</span>.
                      </>
                    ) : (
                      'You are not signed in. Use the account icon in the top bar.'
                    )}
                  </p>
                  {email && (
                    <button
                      onClick={signOut}
                      className="mt-2 flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-[#30363d] bg-[#21262d] text-[#e6edf3] hover:bg-[#30363d]"
                    >
                      <LogOut size={12} /> Sign out
                    </button>
                  )}
                </section>

                <section>
                  <p className={sectionTitle}>Apply Automatically</p>
                  <p className={sectionText}>
                    When on, proposed edits and new files are applied without asking. You can also turn this on from
                    the Apply Automatically menu.
                  </p>
                  <label className="mt-2 flex items-center justify-between gap-4 text-sm text-[#e6edf3]">
                    Apply Automatically Forever
                    <button
                      type="button"
                      role="switch"
                      aria-checked={forever}
                      onClick={toggleForever}
                      className={cn(
                        'relative w-9 h-5 rounded-full transition-colors',
                        forever ? 'bg-[#238636]' : 'bg-[#30363d]'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                          forever && 'translate-x-4'
                        )}
                      />
                    </button>
                  </label>
                  <p className={sectionText}>
                    When on, code the AI wants to run runs without asking. You can also turn this on from the Run
                    Automatically menu.
                  </p>
                  <label className="mt-2 flex items-center justify-between gap-4 text-sm text-[#e6edf3]">
                    Run Automatically Forever
                    <button
                      type="button"
                      role="switch"
                      aria-checked={runForever}
                      onClick={toggleRunForever}
                      className={cn(
                        'relative w-9 h-5 rounded-full transition-colors',
                        runForever ? 'bg-[#238636]' : 'bg-[#30363d]'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                          runForever && 'translate-x-4'
                        )}
                      />
                    </button>
                  </label>
                </section>

                <section>
                  <p className={sectionTitle}>Chat box style</p>
                  <div className="mt-2 space-y-2">
                    {CHAT_STYLES.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => setChatStyle(o.value)}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded border text-xs',
                          chatStyle === o.value ? 'border-[#58a6ff] bg-[#21262d]' : 'border-[#30363d] hover:bg-[#21262d]'
                        )}
                      >
                        <span className="block text-sm text-[#e6edf3]">{o.label}</span>
                        <span className="block text-[#8b949e]">{o.desc}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}

            {tab === 'models' && (
              <>
                <section>
                  <p className={sectionTitle}>Default model</p>
                  <p className={sectionText}>Used for new chats. Groq models need you to be signed in.</p>
                  <select
                    value={selectedModel}
                    onChange={(e) => setModel(e.target.value)}
                    className="mt-2 w-full px-2 py-1.5 text-sm rounded border border-[#30363d] bg-[#0d1117] text-[#e6edf3]"
                  >
                    <optgroup label="Groq (cloud)">
                      {GROQ_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Local and browser">
                      {LOCAL_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <p className={sectionText}>
                    Groq replies are generated by Groq. Your messages and any @-mentioned files are sent to Groq.
                  </p>
                </section>

                <section>
                  <p className={sectionTitle}>Browser models</p>
                  <div className="mt-2">
                    <BrowserModelsSection />
                  </div>
                </section>
              </>
            )}

            {tab === 'memory' && (
              <section>
                <p className={sectionTitle}>Memory</p>
                <p className={sectionText}>
                  Notes the AI saved for this project. Edit or delete any note the AI saved.
                </p>
                {!projectId && <p className="mt-3 text-xs text-[#8b949e]">Open a project to see its memory.</p>}
                {projectId && notes.length === 0 && (
                  <p className="mt-3 text-xs text-[#8b949e]">No notes yet.</p>
                )}
                <ul className="mt-3 space-y-1.5">
                  {notes.map((note, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-2 px-2.5 py-2 rounded border border-[#30363d] bg-[#0d1117]"
                    >
                      {editing === i ? (
                        <>
                          <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(note)
                              if (e.key === 'Escape') setEditing(null)
                            }}
                            className="flex-1 bg-transparent text-xs text-[#e6edf3] outline-none border-b border-[#58a6ff]"
                          />
                          <button
                            onClick={() => saveEdit(note)}
                            title="Save note"
                            className="shrink-0 p-1 rounded text-[#8b949e] hover:text-[#3fb950] hover:bg-[#21262d]"
                          >
                            <CheckIcon size={12} />
                          </button>
                          <button
                            onClick={() => setEditing(null)}
                            title="Cancel"
                            className="shrink-0 p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d]"
                          >
                            <XIcon size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-[#e6edf3] break-words">{note}</span>
                          <div className="flex shrink-0">
                            <button
                              onClick={() => {
                                setEditing(i)
                                setDraft(note)
                              }}
                              title="Edit note"
                              className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d]"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => deleteNote(note)}
                              title="Delete note"
                              className="p-1 rounded text-[#8b949e] hover:text-[#ff7b72] hover:bg-[#21262d]"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}