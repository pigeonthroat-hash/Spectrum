import { supabase } from '../supabase'

export const GROQ_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/groq-chat`

// Returns the signed-in user's token. The server checks it before calling Groq.
export async function getSignedInToken(): Promise<string> {
  // Add the ! right after supabase
  const { data } = await supabase!.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sign in to use Groq models. Use the account icon in the top bar.')
  return token
}