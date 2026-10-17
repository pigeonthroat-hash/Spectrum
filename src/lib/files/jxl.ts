// JPEG XL support. The encoder and decoder are loaded only when an image is converted or shown,
// so the rest of the app does not pay for them.

async function toImageData(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read this image')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

// Returns JPEG XL bytes only when they are smaller than the original; otherwise null
export async function toJxlIfSmaller(bytes: Uint8Array, mime: string): Promise<Uint8Array | null> {
  const imageData = await toImageData(new Blob([bytes as BlobPart], { type: mime }))
  const { encode } = await import('@jsquash/jxl')
  const encoded = new Uint8Array(await encode(imageData, { quality: 85 }))
  return encoded.byteLength < bytes.byteLength ? encoded : null
}

// Shows a JPEG XL file: decodes it and returns a PNG address the browser can display
export async function jxlToObjectUrl(bytes: Uint8Array): Promise<string> {
  const { decode } = await import('@jsquash/jxl')
  const imageData = await decode(bytes.slice().buffer)
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not show this image')
  ctx.putImageData(imageData, 0, 0)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not show this image'))), 'image/png')
  )
  return URL.createObjectURL(blob)
}