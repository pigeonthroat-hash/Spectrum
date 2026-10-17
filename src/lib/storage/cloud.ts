import { supabase } from '../supabase'
import {
  decodeBytes,
  decodeText,
  encodeBytes,
  encodeText,
  MAX_UPLOAD_BYTES,
  type ChunkRef,
  type EncodedFile,
} from './chunk'
import type { FileNode, StorageProvider } from './types'

// Cloud projects stored in Supabase. Requires sign-in.
// Tables: projects, files (manifests). Bucket: chunks ("<user id>/<hash>").

const BUCKET = 'chunks'
const KEEP = '.keep' // placeholder file so empty folders survive

export interface ProjectRow {
  id: string
  name: string
  updated_at: string
}

interface FileRow {
  path: string
  version: number
  size: number
  sha256: string
  compressed: boolean
  chunks: ChunkRef[]
  kind?: 'text' | 'binary'
}

function client() {
  if (!supabase) throw new Error('Cloud storage is not set up in this build')
  return supabase
}

async function fetchUserId(): Promise<string> {
  const { data, error } = await client().auth.getUser()
  if (error || !data.user) throw new Error('Sign in to use cloud projects')
  return data.user.id
}

// ---- Projects ----

export async function listProjects(): Promise<ProjectRow[]> {
  const { data, error } = await client()
    .from('projects')
    .select('id,name,updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProjectRow[]
}

export async function createProject(name: string): Promise<ProjectRow> {
  const owner_id = await fetchUserId()
  const { data, error } = await client()
    .from('projects')
    .insert({ name, owner_id })
    .select('id,name,updated_at')
    .single()
  if (error) throw error
  return data as ProjectRow
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await client().from('projects').delete().eq('id', id)
  if (error) throw error
}

// ---- Files in one project ----

export class CloudStorage implements StorageProvider {
  private projectId: string
  private userId?: string

  constructor(projectId: string) {
    this.projectId = projectId
  }

  private async uid(): Promise<string> {
    if (!this.userId) this.userId = await fetchUserId()
    return this.userId
  }

  private async getRow(path: string): Promise<FileRow | null> {
    const { data, error } = await client()
      .from('files')
      .select('path,version,size,sha256,compressed,chunks,kind')
      .eq('project_id', this.projectId)
      .eq('path', path)
      .maybeSingle()
    if (error) throw error
    return (data as FileRow | null) ?? null
  }

  private async uploadChunk(hash: string, data: Uint8Array): Promise<void> {
    const userId = await this.uid()
    const { error } = await client()
      .storage.from(BUCKET)
      .upload(`${userId}/${hash}`, new Blob([data as BlobPart]), {
        contentType: 'application/octet-stream',
      })
    // The same chunk may already be stored (identical content). That's fine.
    if (error && !/exist|duplicate|409/i.test(error.message)) throw error
  }

  private async downloadChunk(hash: string): Promise<Uint8Array> {
    const userId = await this.uid()
    const { data, error } = await client().storage.from(BUCKET).download(`${userId}/${hash}`)
    if (error || !data) throw new Error(`A piece of this file is missing (${hash.slice(0, 8)})`)
    return new Uint8Array(await data.arrayBuffer())
  }

  async listTree(root = ''): Promise<FileNode[]> {
    const { data, error } = await client()
      .from('files')
      .select('path')
      .eq('project_id', this.projectId)
    if (error) throw error
    const paths = ((data ?? []) as { path: string }[]).map((r) => r.path)
    const tree = buildTree(paths)
    if (!root) return tree
    return findNode(tree, root)?.children ?? []
  }

  async readFile(path: string): Promise<string> {
    const row = await this.getRow(path)
    if (!row) throw new Error(`File not found: ${path}`)
    return decodeText(row, (hash) => this.downloadChunk(hash))
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.store(path, await encodeText(content), 'text')
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const row = await this.getRow(path)
    if (!row) throw new Error(`File not found: ${path}`)
    return decodeBytes(row, (hash) => this.downloadChunk(hash))
  }

  // Uploaded files (images, raw data) are limited to 10 MB
  async writeBytes(path: string, data: Uint8Array): Promise<void> {
    await this.store(path, await encodeBytes(data, MAX_UPLOAD_BYTES), 'binary')
  }

  private async store(path: string, encoded: EncodedFile, kind: 'text' | 'binary'): Promise<void> {
    for (const chunk of encoded.chunks) {
      await this.uploadChunk(chunk.hash, chunk.data)
    }

    const existing = await this.getRow(path)
    const now = new Date().toISOString()
    const { error } = await client()
      .from('files')
      .upsert(
        {
          project_id: this.projectId,
          path,
          version: (existing?.version ?? 0) + 1,
          size: encoded.size,
          sha256: encoded.sha256,
          compressed: encoded.compressed,
          chunks: encoded.refs,
          kind,
          updated_at: now,
        },
        { onConflict: 'project_id,path' }
      )
    if (error) throw error

    await client().from('projects').update({ updated_at: now }).eq('id', this.projectId)
  }

  async createFile(path: string): Promise<void> {
    await this.writeFile(path, '')
  }

  async createFolder(path: string): Promise<void> {
    await this.writeFile(`${path}/${KEEP}`, '')
  }

  // Moves or renames a file or a whole folder. Only the paths in the database change;
  // the stored pieces are reused, so nothing is re-uploaded.
  async rename(from: string, to: string): Promise<void> {
    if (from === to) return
    if (to.startsWith(`${from}/`)) throw new Error('A folder cannot be moved inside itself')

    const clashes = [
      ...(await this.selectRows(to, false)),
      ...(await this.selectRows(to, true)),
    ]
    if (clashes.length > 0) throw new Error('Something with that name already exists there')

    const rows = [
      ...(await this.selectRows(from, false)),
      ...(await this.selectRows(from, true)),
    ]
    for (const row of rows) {
      const { error } = await client()
        .from('files')
        .update({ path: to + row.path.slice(from.length) })
        .eq('id', row.id)
      if (error) throw error
    }
  }

  // Finds rows at exactly `path`, or inside it when asPrefix is true
  private async selectRows(path: string, asPrefix: boolean): Promise<{ id: string; path: string }[]> {
    const base = client().from('files').select('id,path').eq('project_id', this.projectId)
    const { data, error } = asPrefix ? await base.like('path', `${path}/%`) : await base.eq('path', path)
    if (error) throw error
    return (data ?? []) as { id: string; path: string }[]
  }

  // Removes a file, or a whole folder and everything inside it.
  // Chunks no longer used are cleaned up by a later job.
  async remove(path: string): Promise<void> {
    const { error: fileError } = await client()
      .from('files')
      .delete()
      .eq('project_id', this.projectId)
      .eq('path', path)
    if (fileError) throw fileError

    const { error: folderError } = await client()
      .from('files')
      .delete()
      .eq('project_id', this.projectId)
      .like('path', `${path}/%`)
    if (folderError) throw folderError
  }
}

// ---- Helpers ----

// Turns a flat list of paths into a folder tree.
// "a/.keep" creates folder "a" with no file inside.
function buildTree(paths: string[]): FileNode[] {
  const top: FileNode[] = []
  const byPath = new Map<string, FileNode>()

  for (const full of paths) {
    const parts = full.split('/')
    let prefix = ''
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const path = prefix ? `${prefix}/${name}` : name
      const last = i === parts.length - 1
      if (last && name === KEEP) break

      if (!byPath.has(path)) {
        const node: FileNode = last
          ? { name, path, type: 'file' }
          : { name, path, type: 'folder', children: [] }
        byPath.set(path, node)
        const siblings = prefix ? byPath.get(prefix)?.children ?? [] : top
        siblings.push(node)
      }
      prefix = path
    }
  }
  return sortTree(top)
}

function sortTree(nodes: FileNode[]): FileNode[] {
  for (const n of nodes) if (n.children) sortTree(n.children)
  return nodes.sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1
  )
}

function findNode(nodes: FileNode[], path: string): FileNode | undefined {
  for (const n of nodes) {
    if (n.path === path) return n
    if (n.children) {
      const hit = findNode(n.children, path)
      if (hit) return hit
    }
  }
  return undefined
}