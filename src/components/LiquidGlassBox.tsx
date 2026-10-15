import { useEffect, useRef, type ReactNode } from 'react'

// Loaded from the CDN (as the library's README shows), so no npm install is needed.
const LIQUID_GLASS_URL = 'https://cdn.jsdelivr.net/npm/@ybouane/liquidglass/dist/index.js'

interface GlassInstance {
  destroy: () => void
}

interface LiquidGlassModule {
  LiquidGlass: {
    init: (opts: { root: HTMLElement; glassElements: HTMLElement[] }) => Promise<GlassInstance>
  }
}

const GLASS_CONFIG = {
  blurAmount: 0.15,
  refraction: 0.6,
  chromAberration: 0.05,
  edgeHighlight: 0.12,
  specular: 0.3,
  fresnel: 0.8,
  cornerRadius: 18,
  zRadius: 14,
  shadowOpacity: 0.35,
  shadowSpread: 8,
  shadowOffsetY: 2,
  tintStrength: 0.2,
  brightness: -0.05,
}

// Load the library once and reuse it for every chat box
let libPromise: Promise<LiquidGlassModule> | null = null
const loadLiquidGlass = (): Promise<LiquidGlassModule> => {
  if (!libPromise) {
    libPromise = import(/* @vite-ignore */ LIQUID_GLASS_URL) as Promise<LiquidGlassModule>
  }
  return libPromise
}

// Wraps children in a liquid glass panel.
// The glass element must be a direct child of the root, and the root needs a
// background sibling for the glass to refract.
export function LiquidGlassBox({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const glassRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const glass = glassRef.current
    if (!root || !glass) return

    let instance: GlassInstance | null = null
    let cancelled = false

    loadLiquidGlass()
      .then((lib) => lib.LiquidGlass.init({ root, glassElements: [glass] }))
      .then((i) => {
        if (cancelled) i.destroy()
        else instance = i
      })
      .catch((err: unknown) => console.warn('Liquid glass failed to start, showing plain box', err))

    return () => {
      cancelled = true
      instance?.destroy()
    }
  }, [])

  return (
    <div ref={rootRef} className="relative p-2 rounded-2xl">
      <div
        aria-hidden
        className="absolute inset-0 rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, #238636 0%, #1f6feb 50%, #8957e5 100%)',
          opacity: 0.45,
        }}
      />
      <div
        ref={glassRef}
        data-config={JSON.stringify(GLASS_CONFIG)}
        className="liquid-glass relative p-2.5 rounded-[18px]"
      >
        {children}
      </div>
    </div>
  )
}
