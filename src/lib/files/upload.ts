import { useAppStore } from '../../store/useAppStore'
import { storageFor } from '../storage/active'
import { listPaths } from '../agent/tools'
import { MAX_UPLOAD_BYTES } from '../storage/chunk'
import { errorText } from '../errors'
import { toJxlIfSmaller } from './jxl'
import { isUploadImage } from './kinds'

// Uploads files into the project root. PNG and JPEG images become JPEG XL when that makes them smaller.
export async function uploadFiles(files: File[], projectId: string): Promise<void> {
  const storage = storageFor(projectId)
  const existing = new Set(await listPaths(projectId))
  const problems: string[] = []

  for (const file of files) {
    try {
      if (file.size > MAX_UPLOAD_BYTES) {
        problems.push(file.name + ' is larger than 10 MB.')
        continue
      }
      let name = file.name
      let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer())
      if (isUploadImage(file.name)) {
        const jxl = await toJxlIfSmaller(bytes, file.type || 'image/png')
        if (jxl) {
          bytes = jxl
          name = file.name.replace(/\.[^.]+$/, '') + '.jxl'
        }
      }
      if (existing.has(name)) {
        problems.push(name + ' already exists.')
        continue
      }
      await storage.writeBytes(name, bytes)
      existing.add(name)
    } catch (err) {
      problems.push(file.name + ': ' + errorText(err))
    }
  }

  useAppStore.getState().setFileTree(await storage.listTree())
  if (problems.length > 0) window.alert(problems.join('\n'))
}