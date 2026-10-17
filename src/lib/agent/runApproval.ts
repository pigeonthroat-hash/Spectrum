// Approval for code the agent wants to run. Same choices as Apply Automatically:
// ask each time, allow for this message, this session, or forever.
export type RunChoice = 'once' | 'message' | 'session' | 'forever' | 'decline'
export type RunDecision = 'run' | 'decline' | 'cancel'

const FOREVER_KEY = 'spectrum-run-forever'
let sessionAllowed = false
let replyId: string | null = null
let messageAllowedFor: string | null = null
const waiting = new Map<string, (d: RunDecision) => void>()

// Called when a new reply starts, so "this message" means that reply only
export function startRunReply(): void {
  replyId = crypto.randomUUID()
}

export function getRunForever(): boolean {
  try {
    return localStorage.getItem(FOREVER_KEY) === '1'
  } catch {
    return false
  }
}

export function setRunForever(on: boolean): void {
  try {
    localStorage.setItem(FOREVER_KEY, on ? '1' : '0')
  } catch {
    sessionAllowed = sessionAllowed || on
  }
}

export function isRunAllowed(): boolean {
  return getRunForever() || sessionAllowed || (replyId !== null && messageAllowedFor === replyId)
}

// Resolves to 'run' straight away when allowed. Otherwise calls onWait (so the card can show the
// choices) and waits for the user's answer.
export function awaitRunApproval(id: string, onWait: () => void): Promise<RunDecision> {
  if (isRunAllowed()) return Promise.resolve('run')
  onWait()
  return new Promise((resolve) => waiting.set(id, resolve))
}

export function answerRun(id: string, choice: RunChoice): void {
  const resolve = waiting.get(id)
  if (!resolve) return
  waiting.delete(id)
  if (choice === 'message') messageAllowedFor = replyId
  if (choice === 'session') sessionAllowed = true
  if (choice === 'forever') setRunForever(true)
  resolve(choice === 'decline' ? 'decline' : 'run')
}

// Stop pressed: every run waiting for approval is cancelled
export function cancelAllRuns(): void {
  for (const [id, resolve] of [...waiting.entries()]) {
    waiting.delete(id)
    resolve('cancel')
  }
}