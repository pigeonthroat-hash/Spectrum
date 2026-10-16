// API keys for cloud providers.
// TEST ONLY: keys are kept in this browser's localStorage so you can try a provider.
// Before anyone else uses Spectrum, keys move to the server (Supabase Edge Function), per the plan.

const keyName = (provider: string) => `spectrum-key:${provider}`

export function getApiKey(provider: string): string | null {
  try {
    return localStorage.getItem(keyName(provider))
  } catch {
    return null
  }
}

export function setApiKey(provider: string, key: string): void {
  localStorage.setItem(keyName(provider), key.trim())
}

export function removeApiKey(provider: string): void {
  localStorage.removeItem(keyName(provider))
}