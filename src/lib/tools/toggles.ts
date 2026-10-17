import { create } from 'zustand'
import { TOOLS } from './registry'

// Optional tools the user has turned on in the @ menu. Kept for the session.
// Always-on tools are not listed here.
interface ToggleState {
  enabled: string[]
  toggle: (name: string) => void
}

export const useToolToggles = create<ToggleState>()((set, get) => ({
  enabled: [],
  toggle: (name) => {
    const on = get().enabled.includes(name)
    set({ enabled: on ? get().enabled.filter((n) => n !== name) : [...get().enabled, name] })
  },
}))

// Always-on tools are always allowed; optional tools only when turned on
export function isToolOn(name: string): boolean {
  const tool = TOOLS.find((t) => t.name === name || t.aliases?.includes(name))
  if (!tool) return false
  if (!tool.optional) return true
  return useToolToggles.getState().enabled.includes(tool.name)
}