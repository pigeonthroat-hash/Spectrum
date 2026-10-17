// Apply Automatically: lets proposed edits apply without a click.
// Three scopes:
//   message: only the reply that was running when this was turned on
//   session: until the page is reloaded
//   forever: saved in this browser until it is turned off
const FOREVER_KEY = 'spectrum-auto-apply-forever'

let sessionOn = false
let messageReplyId: string | null = null
let currentReplyId: string | null = null

// Called when a new reply starts, so "this message" means that reply
export function markReplyStarted(id: string | null): void {
  currentReplyId = id
}

export function getForever(): boolean {
  try {
    return localStorage.getItem(FOREVER_KEY) === '1'
  } catch {
    return false
  }
}

export function setForever(on: boolean): void {
  try {
    localStorage.setItem(FOREVER_KEY, on ? '1' : '0')
  } catch {
    // Storage can be blocked; the setting then lasts for this session only
    sessionOn = sessionOn || on
  }
}

export type AutoApplyScope = 'message' | 'session' | 'forever'

export function enableAutoApply(scope: AutoApplyScope): void {
  if (scope === 'message') messageReplyId = currentReplyId
  if (scope === 'session') sessionOn = true
  if (scope === 'forever') setForever(true)
}

export function isAutoApplyOn(): boolean {
  if (getForever() || sessionOn) return true
  return messageReplyId !== null && messageReplyId === currentReplyId
}