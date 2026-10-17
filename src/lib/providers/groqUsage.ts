import { create } from 'zustand'

// Requests left today, from the Groq function. Null until the first Groq request in this session.
export const useGroqUsage = create<{ remaining: number | null; setRemaining: (n: number | null) => void }>()((set) => ({
  remaining: null,
  setRemaining: (n) => set({ remaining: n }),
}))

export function noteGroqUsage(res: Response): void {
  const left = res.headers.get('X-Requests-Remaining')
  if (left !== null && !Number.isNaN(Number(left))) useGroqUsage.getState().setRemaining(Number(left))
}