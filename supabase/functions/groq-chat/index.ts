import { createClient } from 'npm:@supabase/supabase-js@2'

// Change these, then redeploy
const DAILY_LIMIT = 45
const OWNER_EMAIL = 'pigeonthroat@gmail.com' // NEW
const OWNER_LIMIT = 500                      // NEW
const ALLOWED_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']
const ALLOWED_ORIGINS = ['https://pigeonthroat-hash.github.io', 'http://localhost:5173']
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Only these fields are passed on to Groq
const PASS_THROUGH = ['model', 'messages', 'stream', 'stop', 'max_tokens', 'tools', 'tool_choice']

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function fail(status: number, message: string, origin: string | null) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return fail(405, 'Method not allowed', origin)

  // 1. The user must be signed in
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  if (!token) return fail(401, 'Sign in to use Groq models.', origin)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return fail(401, 'Sign in to use Groq models.', origin)

  // 2. Read the request and check the model
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail(400, 'Request body must be JSON.', origin)
  }
  if (typeof body.model !== 'string' || !ALLOWED_MODELS.includes(body.model)) {
    return fail(400, 'That model is not available through Spectrum.', origin)
  }

  // 3. Count this request against the user's daily limit (higher for the owner)
  const limit = userData.user.email === OWNER_EMAIL ? OWNER_LIMIT : DAILY_LIMIT
  const { data: count, error: countError } = await supabase.rpc('use_groq_request', {
    daily_limit: limit,
  })
  if (countError) return fail(500, 'Could not check the daily limit. Try again.', origin)
  if (count === -1) return fail(403, `Daily limit reached (${limit} requests). Try again tomorrow.`, origin)

  // 4. Forward to Groq using the secret key
  const forward: Record<string, unknown> = {}
  for (const k of PASS_THROUGH) if (body[k] !== undefined) forward[k] = body[k]

  const groq = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
    },
    body: JSON.stringify(forward),
  })

  // 5. Pass the reply (streamed or not) straight back to the app
  return new Response(groq.body, {
    status: groq.status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': groq.headers.get('Content-Type') ?? 'application/json',
      'X-Requests-Remaining': String(Math.max(0, limit - Number(count))),
      'X-Requests-Limit': String(limit),
      'Access-Control-Expose-Headers': 'X-Requests-Remaining, X-Requests-Limit',
    },
  })
})