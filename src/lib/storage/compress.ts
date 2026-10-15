// Gzip using the browser's built-in CompressionStream (Chrome, Edge, Firefox, Safari, Electron)

async function run(data: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const piped = new Blob([data as BlobPart]).stream().pipeThrough(transform)
  return new Uint8Array(await new Response(piped).arrayBuffer())
}

export const gzip = (data: Uint8Array) => run(data, new CompressionStream('gzip'))
export const gunzip = (data: Uint8Array) => run(data, new DecompressionStream('gzip'))
