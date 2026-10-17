import { gzip, gunzip } from './compress'

export const CHUNK_SIZE = 512 * 1024 // 512 KB per chunk, well under the 50 MB object limit
export const MAX_FILE_BYTES = 100 * 1024 * 1024 // 100 MB per text file
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB per uploaded file (images, raw data)

export interface ChunkRef {
  hash: string // SHA-256 of the stored bytes; also the chunk's name
  bytes: number
}

export interface FileManifest {
  path: string
  version: number
  size: number // original length in bytes
  sha256: string // SHA-256 of the original bytes
  compressed: boolean
  chunks: ChunkRef[] // in order
}

export interface EncodedChunk {
  hash: string
  data: Uint8Array
}

export interface EncodedFile {
  sha256: string
  size: number
  compressed: boolean
  chunks: EncodedChunk[]
  refs: ChunkRef[]
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

// Bytes -> compressed (if smaller) -> chunks with checksums
export async function encodeBytes(original: Uint8Array, limit = MAX_FILE_BYTES): Promise<EncodedFile> {
  if (original.byteLength > limit) {
    throw new Error(`File is too large (limit is ${limit / (1024 * 1024)} MB)`)
  }

  const gz = await gzip(original)
  const compressed = gz.byteLength < original.byteLength
  const stored = compressed ? gz : original

  const chunks: EncodedChunk[] = []
  const refs: ChunkRef[] = []
  for (let offset = 0; offset < stored.byteLength; offset += CHUNK_SIZE) {
    const data = stored.slice(offset, offset + CHUNK_SIZE)
    const hash = await sha256Hex(data)
    chunks.push({ hash, data })
    refs.push({ hash, bytes: data.byteLength })
  }

  return {
    sha256: await sha256Hex(original),
    size: original.byteLength,
    compressed,
    chunks,
    refs,
  }
}

export function encodeText(text: string): Promise<EncodedFile> {
  return encodeBytes(encoder.encode(text))
}

// Chunks -> verify each one -> join -> verify whole file -> decompress -> bytes
export async function decodeBytes(
  manifest: Pick<FileManifest, 'sha256' | 'compressed' | 'chunks'>,
  fetchChunk: (hash: string) => Promise<Uint8Array>
): Promise<Uint8Array> {
  const parts = await Promise.all(
    manifest.chunks.map(async (ref) => {
      const data = await fetchChunk(ref.hash)
      if ((await sha256Hex(data)) !== ref.hash) {
        throw new Error(`Chunk ${ref.hash.slice(0, 8)} failed its checksum. The file may be damaged.`)
      }
      return data
    })
  )

  const stored = concat(parts)
  const original = manifest.compressed ? await gunzip(stored) : stored

  if ((await sha256Hex(original)) !== manifest.sha256) {
    throw new Error('File checksum does not match. The file may be damaged.')
  }
  return original
}

export async function decodeText(
  manifest: Pick<FileManifest, 'sha256' | 'compressed' | 'chunks'>,
  fetchChunk: (hash: string) => Promise<Uint8Array>
): Promise<string> {
  return decoder.decode(await decodeBytes(manifest, fetchChunk))
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.byteLength
  }
  return out
}