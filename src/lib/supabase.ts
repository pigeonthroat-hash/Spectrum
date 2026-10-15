import { createClient } from '@supabase/supabase-js'

// Values come from .env.local (see .env.example). Only the publishable key goes here.
// It is safe in the browser because row-level security protects the data.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabaseConfigured = Boolean(url && key)

export const supabase = supabaseConfigured
  ? createClient(url as string, key as string)
  : null