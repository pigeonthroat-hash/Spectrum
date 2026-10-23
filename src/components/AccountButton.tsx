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
        className={`p-1.5 rounded hover:bg-[#2a261f] hover:text-white ${
          user ? 'text-[#f0a93b]' : 'text-[#938a7c]'
        }`}
      >
        <User size={16} />
      </button>

      {open && (
        <div className="anim-pop absolute right-0 top-full mt-1 w-64 z-50 bg-[#15130f] border border-[#2d2921] rounded-lg shadow-xl p-3 text-xs text-[#ece6da]">
          {!supabaseConfigured ? (
            <p className="text-[#938a7c]">Cloud accounts are not set up in this build.</p>
          ) : user ? (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#938a7c]">Signed in as</p>
                <p className="truncate">{user.email}</p>
              </div>
              <button
                onClick={() => run(signOut)}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded border border-[#2d2921] hover:bg-[#2a261f] disabled:opacity-50"
              >
                <LogOut size={12} /> Sign out
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={() => run(signInWithGitHub)}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-[#2a261f] border border-[#2d2921] hover:bg-[#2d2921] disabled:opacity-50"
              >
                <Github size={12} /> Continue with GitHub
              </button>

              <div className="flex items-center gap-2 text-[#938a7c]">
                <div className="flex-1 h-px bg-[#2d2921]" />
                or
                <div className="flex-1 h-px bg-[#2d2921]" />
              </div>

              <form onSubmit={submit} className="space-y-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full px-2 py-1.5 rounded bg-[#1a1814] border border-[#2d2921] outline-none focus:border-[#f0a93b]"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (6+ characters)"
                  className="w-full px-2 py-1.5 rounded bg-[#1a1814] border border-[#2d2921] outline-none focus:border-[#f0a93b]"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full px-3 py-1.5 rounded bg-[#f0a93b] hover:bg-[#f5b952] text-[#1a1407] disabled:opacity-50"
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
                className="w-full text-[#f0a93b] hover:underline"
              >
                {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
              </button>

              {error && <p className="text-[#f85149]">{error}</p>}
              {notice && <p className="text-[#f0a93b]">{notice}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}