import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Github, LogOut, User } from 'lucide-react'
import { supabaseConfigured } from '../lib/supabase'
import {
  signInWithEmail,
  signInWithGitHub,
  signOut,
  signUpWithEmail,
  useAuth,
} from '../lib/auth'

export function AccountButton() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      if (mode === 'signup') {
        await signUpWithEmail(email, password)
        setNotice('Check your email to confirm your account.')
      } else {
        await signInWithEmail(email, password)
        setOpen(false)
        setPassword('')
      }
    })
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={user ? user.email ?? 'Account' : 'Sign in'}
        className={`p-1.5 rounded hover:bg-[#21262d] hover:text-white ${
          user ? 'text-[#3fb950]' : 'text-[#8b949e]'
        }`}
      >
        <User size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 z-50 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl p-3 text-xs text-[#e6edf3]">
          {!supabaseConfigured ? (
            <p className="text-[#8b949e]">Cloud accounts are not set up in this build.</p>
          ) : user ? (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#8b949e]">Signed in as</p>
                <p className="truncate">{user.email}</p>
              </div>
              <button
                onClick={() => run(signOut)}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded border border-[#30363d] hover:bg-[#21262d] disabled:opacity-50"
              >
                <LogOut size={12} /> Sign out
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={() => run(signInWithGitHub)}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] disabled:opacity-50"
              >
                <Github size={12} /> Continue with GitHub
              </button>

              <div className="flex items-center gap-2 text-[#8b949e]">
                <div className="flex-1 h-px bg-[#30363d]" />
                or
                <div className="flex-1 h-px bg-[#30363d]" />
              </div>

              <form onSubmit={submit} className="space-y-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full px-2 py-1.5 rounded bg-[#0d1117] border border-[#30363d] outline-none focus:border-[#58a6ff]"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (6+ characters)"
                  className="w-full px-2 py-1.5 rounded bg-[#0d1117] border border-[#30363d] outline-none focus:border-[#58a6ff]"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full px-3 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white disabled:opacity-50"
                >
                  {mode === 'signup' ? 'Create account' : 'Sign in'}
                </button>
              </form>

              <button
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin')
                  setError(null)
                  setNotice(null)
                }}
                className="w-full text-[#58a6ff] hover:underline"
              >
                {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
              </button>

              {error && <p className="text-[#f85149]">{error}</p>}
              {notice && <p className="text-[#3fb950]">{notice}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}