import { CloudStorage } from './cloud'

// Reuses one CloudStorage per project so the user id is looked up only once
let cache: { projectId: string; storage: CloudStorage } | null = null

export function storageFor(projectId: string): CloudStorage {
  if (!cache || cache.projectId !== projectId) {
    cache = { projectId, storage: new CloudStorage(projectId) }
  }
  return cache.storage
}