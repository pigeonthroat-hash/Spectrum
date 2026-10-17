import { useEffect, useRef, useState } from 'react'
import { storageFor } from '../lib/storage/active'
import { jxlToObjectUrl } from '../lib/files/jxl'
import { imageMime } from '../lib/files/kinds'

const MIN_ZOOM = 0.05
const MAX_ZOOM = 16

const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

// Shows a picture in the editor area. Zoom with the trackpad (pinch) or the mouse wheel.
export function ImageViewer({ projectId, path, name }: { projectId: string; path: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState<number | null>(null) // null = fit the window

  const viewport = useRef<HTMLDivElement>(null)
  const naturalRef = useRef(natural)
  const zoomRef = useRef(zoom)
  naturalRef.current = natural
  zoomRef.current = zoom

  // The zoom level shown now, including "fit" when no zoom has been chosen
  const currentZoom = (): number => {
    if (zoomRef.current !== null) return zoomRef.current
    const el = viewport.current
    const nat = naturalRef.current
    if (!el || !nat) return 1
    return Math.min(el.clientWidth / nat.w, el.clientHeight / nat.h, 1)
  }

  // Load the picture; JPEG XL files are decoded for display
  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    setUrl(null)
    setError(null)
    setNatural(null)
    setZoom(null)
    void (async () => {
      try {
        const bytes = await storageFor(projectId).readBytes(path)
        objectUrl = name.toLowerCase().endsWith('.jxl')
          ? await jxlToObjectUrl(bytes)
          : URL.createObjectURL(new Blob([bytes as BlobPart], { type: imageMime(name) }))
        if (cancelled) URL.revokeObjectURL(objectUrl)
        else setUrl(objectUrl)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not open this image')
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [projectId, path, name])

  // Wheel and trackpad zoom. Needs a non-passive listener so the page does not scroll too.
  useEffect(() => {
    const el = viewport.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom(clamp(currentZoom() * Math.exp(-e.deltaY * 0.002)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [url])

  const step = (factor: number) => setZoom(clamp(currentZoom() * factor))

  const button = 'px-2 py-0.5 rounded border border-[#30363d] bg-[#21262d] text-[#e6edf3] hover:bg-[#30363d] text-xs'

  return (
    <div className="absolute inset-0 flex flex-col bg-[#1e1e1e]">
      <div ref={viewport} className="flex-1 min-h-0 overflow-auto p-4 flex">
        {error && <p className="m-auto text-sm text-[#ff7b72]">{error}</p>}
        {!error && !url && <p className="m-auto text-sm text-[#8b949e]">Loading image...</p>}
        {url && (
          <img
            src={url}
            alt={name}
            draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            className="m-auto select-none"
            style={
              zoom === null
                ? { maxWidth: '100%', maxHeight: '100%' }
                : natural
                  ? { width: natural.w * zoom, height: natural.h * zoom, maxWidth: 'none' }
                  : undefined
            }
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-1 bg-[#161b22] border-t border-[#30363d] text-xs text-[#8b949e]">
        <span>{natural ? natural.w + ' × ' + natural.h + ' px' : ''}</span>
        <div className="flex items-center gap-1.5">
          <button type="button" className={button} onClick={() => step(0.8)}>−</button>
          <button type="button" className={button} onClick={() => setZoom(null)}>Fit</button>
          <button type="button" className={button} onClick={() => setZoom(1)}>100%</button>
          <button type="button" className={button} onClick={() => step(1.25)}>+</button>
          <span className="w-12 text-right text-[#e6edf3]">
            {zoom === null ? 'Fit' : Math.round(zoom * 100) + '%'}
          </span>
        </div>
      </div>
    </div>
  )
}