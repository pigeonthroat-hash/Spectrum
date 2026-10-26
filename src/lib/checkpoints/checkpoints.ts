import { storageFor } from '../storage/active'
import { listAllPaths } from '../agent/tools'
import { clearReadCache } from '../agent/readCache'
import { isBinaryName } from '../files/kinds'
import { useAppStore } from '../../store/useAppStore'

// A checkpoint is a copy of the workspace's text files, taken before a message runs.
// Stored as hidden files in the workspace: .spectrum/checkpoints/<messageId>.json
const DIR = '.spectrum/checkpoints'
const INDEX = `${DIR}/index.json`
const TOTAL_LIMIT = 5_000_000 // characters per checkpoint
const FILE_LIMIT = 512_000    // a single file bigger than this is left out
const KEEP = 10               // newest checkpoints kept per workspace

interface Snapshot {
  id: string
  createdAt: number
  // false if any file was left out. Restoring then never deletes files, to be safe.
  complete: boolean
  files: Record<string, string>
}

// Hidden files (names starting with a dot) are not part of checkpoints
const isTracked = (p: string) => !p.split('/').some((seg) => seg.startsWith('.')) && !isBinaryName(p)

export async function takeCheckpoint(projectId: string, id: string): Promise<void> {
  const storage = storageFor(projectId)
  const files: Record<string, string> = {}
  let total = 0
  let complete = true
  for (const p of (await listAllPaths(projectId)).filter(isTracked)) {
    try {
      const text = await storage.readFile(p)
      if (text.length > FILE_LIMIT || total + text.length > TOTAL_LIMIT) {
        complete = false
        continue
      }
      files[p] = text
      total += text.length
    } catch {
      complete = false
    }
  }
  const snap: Snapshot = { id, createdAt: Date.now(), complete, files }
  await storage.writeFile(`${DIR}/${id}.json`, JSON.stringify(snap))

  // Newest first. Anything beyond KEEP is removed, so checkpoints don't grow without limit.
  let ids: string[] = []
  try {
    ids = JSON.parse(await storage.readFile(INDEX)) as string[]
  } catch {
    // no index yet
  }
  ids = [id, ...ids.filter((x) => x !== id)]
  for (const old of ids.slice(KEEP)) {
    try {
      await storage.remove(`${DIR}/${old}.json`)
    } catch {
      // already gone
    }
  }
  await storage.writeFile(INDEX, JSON.stringify(ids.slice(0, KEEP)))
}

// Runs an async task over a list, a few at a time, so cloud reads and writes overlap
async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await task(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

// Reports 0-100 as the restore goes
export async function restoreCheckpoint(
  projectId: string,
  id: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const storage = storageFor(projectId)
  const snap = JSON.parse(await storage.readFile(`${DIR}/${id}.json`)) as Snapshot
  const current = (await listAllPaths(projectId)).filter(isTracked)
  const existing = new Set(current)

  // Only files whose content actually differs are written. Unchanged files are left alone.
  const entries = Object.entries(snap.files)
  // Files created after the checkpoint are removed (only when the snapshot is complete)
  const keep = new Set(Object.keys(snap.files))
  const toRemove = snap.complete ? current.filter((p) => !keep.has(p)) : []

  // Every checked, written, or removed file moves the bar on
  let done = 0
  let total = entries.length + toRemove.length
  const tick = () => {
    done++
    onProgress?.(Math.min(100, Math.round((done / total) * 100)))
  }
  onProgress?.(0)

  const toWrite = (
    await mapLimit(entries, 6, async ([p, text]) => {
      try {
        if (!existing.has(p)) return [p, text] as const
        try {
          return (await storage.readFile(p)) === text ? null : ([p, text] as const)
        } catch {
          return [p, text] as const
        }
      } finally {
        tick()
      }
    })
  ).filter((x): x is readonly [string, string] => x !== null)

  total += toWrite.length
  await mapLimit(toWrite, 6, async ([p, text]) => {
    try {
      await storage.writeFile(p, text)
    } finally {
      tick()
    }
  })
  await mapLimit(toRemove, 6, async (p) => {
    try {
      await storage.remove(p)
    } finally {
      tick()
    }
  })

  await refreshWorkspaceView(projectId)
  onProgress?.(100)
}

// Brings the explorer and open tabs in line with the files on disk
export async function refreshWorkspaceView(projectId: string): Promise<void> {
  const storage = storageFor(projectId)
  const store = useAppStore.getState()
  store.setFileTree(await storage.listTree())
  for (const tab of store.openTabs) {
    try {
      const content = await storage.readFile(tab.path)
      useAppStore.setState((s) => ({
        openTabs: s.openTabs.map((t) => (t.path === tab.path ? { ...t, content, isDirty: false } : t)),
      }))
    } catch {
      useAppStore.getState().closeTab(tab.path)
    }
  }
  clearReadCache()
}