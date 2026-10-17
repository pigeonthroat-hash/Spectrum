// Per-reply memory of file reads, so a file is read from storage once per reply.
// Cleared whenever a file changes, and at the start of each reply.
const texts = new Map<string, string>()
let listing: string[] | null = null

export function cachedText(path: string): string | undefined {
  return texts.get(path)
}

export function rememberText(path: string, text: string): void {
  texts.set(path, text)
}

export function cachedListing(): string[] | null {
  return listing
}

export function rememberListing(paths: string[]): void {
  listing = paths
}

export function clearReadCache(): void {
  texts.clear()
  listing = null
}