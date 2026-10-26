import { create } from 'zustand'

// Requests used and left today, from the Groq function. Null until the first Groq request in this session.
export const useGroqUsage = create<{
  remaining: number | null
  limit: number | null
  setRemaining: (n: number | null) => void
  setLimit: (n: number | null) => void
}>()((set) => ({
  remaining: null,
  limit: null,
  setRemaining: (n) => set({ remaining: n }),
  setLimit: (n) => set({ limit: n }),
}))

export function noteGroqUsage(res: Response): void {
  const left = res.headers.get('X-Requests-Remaining')
  if (left !== null && !Number.isNaN(Number(left))) useGroqUsage.getState().setRemaining(Number(left))
  const limit = res.headers.get('X-Requests-Limit')
  if (limit !== null && !Number.isNaN(Number(limit))) useGroqUsage.getState().setLimit(Number(limit))
}