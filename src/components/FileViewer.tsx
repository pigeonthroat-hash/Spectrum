import { useState } from 'react'
import { storageFor } from '../lib/storage/active'
import { isImageName } from '../lib/files/kinds'
import { ImageViewer } from './ImageViewer'

// What the editor area shows for a binary file: a picture, or a notice with a Download button
export function FileViewer({ projectId, path, name }: { projectId: string; path: string; name: string }) {
  if (isImageName(name)) return <ImageViewer projectId={projectId} path={path} name={name} />
  return <BinaryNotice projectId={projectId} path={path} name={name} />
}

function BinaryNotice({ projectId, path, name }: { projectId: string; path: string; name: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const download = async () => {
    setBusy(true)
    setError(null)
    try {
      const bytes = await storageFor(projectId).readBytes(path)
      const url = URL.createObjectURL(new Blob([bytes as BlobPart]))
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download this file')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#201d18] text-center">
      <p className="text-sm text-[#ece6da]">{name}</p>
      <p className="text-xs text-[#938a7c]">This file can&apos;t be shown in the editor.</p>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="px-2.5 py-1 text-xs rounded border border-[#2d2921] bg-[#2a261f] text-[#ece6da] hover:bg-[#2d2921] disabled:opacity-50"
      >
        {busy ? 'Preparing...' : 'Download'}
      </button>
      {error && <p className="text-xs text-[#ff7b72]">{error}</p>}
    </div>
  )
}