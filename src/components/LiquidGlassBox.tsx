import { useEffect, useRef, type ReactNode } from 'react'

// Official CDN build from the liquidglass README (no npm install needed)
const LIQUID_GLASS_URL = 'https://cdn.jsdelivr.net/npm/@ybouane/liquidglass/dist/index.js'

interface GlassInstance {
  destroy: () => void
}

interface LiquidGlassModule {
  LiquidGlass: {
    init: (opts: { root: HTMLElement; glassElements: HTMLElement[] }) => Promise<GlassInstance>
  }
}

// Per-element options from the README "Available Options" table
const GLASS_CONFIG = {
  blurAmount: 0.1,
  refraction: 0.7,
  chromAberration: 0.08,
  edgeHighlight: 0.15,
  specular: 0.4,
  fresnel: 1,
  cornerRadius: 14,
  zRadius: 18,
  shadowOpacity: 0.3,
  shadowSpread: 10,
  shadowOffsetY: 2,
  tintStrength: 0.1,
  brightness: 0,
}

let libPromise: Promise<LiquidGlassModule> | null = null
const loadLiquidGlass = (): Promise<LiquidGlassModule> => {
  if (!libPromise) {
    libPromise = import(/* @vite-ignore */ LIQUID_GLASS_URL) as Promise<LiquidGlassModule>
  }
  return libPromise
}

// Structure required by the library:
// - the glass element is a DIRECT child of the root
// - the root's own background is invisible to the shader, so the colored
//   background lives in a sibling element inside the root
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
    <div ref={rootRef} className="relative p-1">
      <div
        aria-hidden
        className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none bg-[#0d1117]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '8px 8px',
        }}
      />
      <div ref={glassRef} data-config={JSON.stringify(GLASS_CONFIG)} className="liquid-glass relative px-2.5 py-2 rounded-[14px]">
        {children}
      </div>
    </div>
  )
}
