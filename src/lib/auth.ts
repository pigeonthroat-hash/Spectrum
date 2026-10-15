import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Where Supabase sends people after sign-in.
// Works on localhost (BASE_URL "/") and on GitHub Pages (BASE_URL "/Spectrum/").
function returnUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString()
}

function requireClient() {
  if (!supabase) throw new Error('Cloud accounts are not set up in this build.')
  return supabase
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return { session, user: session?.user ?? null, loading }
}

export async function signInWithGitHub() {
  const client = requireClient()
  const { error } = await client.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: returnUrl() },
  })
  if (error) throw error
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await requireClient().auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUpWithEmail(email: string, password: string) {
  const { error } = await requireClient().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: returnUrl() },
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await requireClient().auth.signOut()
  if (error) throw error
}