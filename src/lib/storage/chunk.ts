import { gzip, gunzip } from './compress'

export const CHUNK_SIZE = 512 * 1024 // 512 KB per chunk, well under the 50 MB object limit
export const MAX_FILE_BYTES = 100 * 1024 * 1024 // 100 MB per file

export interface ChunkRef {
  hash: string // SHA-256 of the stored bytes; also the chunk's name
  bytes: number
}

export interface FileManifest {
  path: string
  version: number
  size: number // original UTF-8 length
  sha256: string // SHA-256 of the original UTF-8 bytes
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

// Text -> compressed (if smaller) -> chunks with checksums
export async function encodeText(text: string): Promise<EncodedFile> {
  const original = encoder.encode(text)
  if (original.byteLength > MAX_FILE_BYTES) {
    throw new Error(`File is too large (limit is ${MAX_FILE_BYTES / (1024 * 1024)} MB)`)
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

// Chunks -> verify each one -> join -> verify whole file -> decompress -> text
export async function decodeText(
  manifest: Pick<FileManifest, 'sha256' | 'compressed' | 'chunks'>,
  fetchChunk: (hash: string) => Promise<Uint8Array>
): Promise<string> {
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
  return decoder.decode(original)
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
