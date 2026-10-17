// Which files are shown as pictures or downloads instead of opened in the code editor
const IMAGE_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  bmp: 'image/bmp', ico: 'image/x-icon', avif: 'image/avif', jxl: 'image/jxl',
}

const OTHER_BINARY = new Set([
  'pdf', 'zip', 'gz', 'tar', '7z', 'rar', 'mp3', 'wav', 'ogg', 'flac', 'mp4', 'webm', 'mov', 'avi',
  'woff', 'woff2', 'ttf', 'otf', 'eot', 'exe', 'dll', 'bin', 'dat', 'sqlite', 'psd', 'heic',
  'docx', 'xlsx', 'pptx',
])

const ext = (name: string) => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '')

export const isImageName = (name: string) => ext(name) in IMAGE_EXT
export const isBinaryName = (name: string) => isImageName(name) || OTHER_BINARY.has(ext(name))
export const isUploadImage = (name: string) => ['png', 'jpg', 'jpeg'].includes(ext(name))
export const imageMime = (name: string) => IMAGE_EXT[ext(name)] ?? 'application/octet-stream'