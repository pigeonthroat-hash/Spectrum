// Waits for the user to Apply or Decline a proposed change or new file.
// The tool call waits here, so the model keeps going after Apply.
export type Outcome = 'applied' | 'declined' | 'cancelled'

type Waiting = { resolve: (o: Outcome) => void }

const waiting = new Map<string, Waiting>()
const createPaths = new Set<string>()

export function waitForDecision(path: string, kind: 'edit' | 'create'): Promise<Outcome> {
  // A newer proposal for the same file replaces an older one
  decide(path, 'cancelled')
  if (kind === 'create') createPaths.add(path)
  return new Promise((resolve) => {
    waiting.set(path, { resolve })
  })
}

export function decide(path: string, outcome: Outcome): void {
  const w = waiting.get(path)
  if (!w) return
  waiting.delete(path)
  w.resolve(outcome)
}

// Stop pressed: every waiting tool call ends, but the changes stay in the editor for later
export function cancelAllDecisions(): void {
  for (const path of [...waiting.keys()]) decide(path, 'cancelled')
}

export function isCreatePending(path: string): boolean {
  return createPaths.has(path)
}

export function forgetCreate(path: string): void {
  createPaths.delete(path)
}