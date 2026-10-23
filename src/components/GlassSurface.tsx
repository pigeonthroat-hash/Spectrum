import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react'
import liquidGL, { type LiquidGLLens, type LiquidGLOptions } from 'liquid-gl'

export interface GlassSurfaceProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** Stacking order. Glass surfaces on the same page must share one value. */
  zIndex?: number
  /** Optional dye for the glass, any CSS colour. The alpha is the strength. */
  tint?: string
  /** When false, the plain surface is shown and no WebGL work happens. */
  enabled?: boolean
  /** Extra liquidGL options, for tuning one surface. */
  options?: Partial<LiquidGLOptions>
}

// Defaults for interface chrome: calm refraction, no heavy bevel, no drop shadow
const DEFAULTS: Partial<LiquidGLOptions> = {
  engine: 'auto',
  refraction: 0.03,
  bevelDepth: 0.06,
  bevelWidth: 0.2,
  frost: 0,
  shadow: false,
  // Specular highlights animate across the pane, which reads as moving grey. Off for interface chrome.
  specular: false,
  reveal: 'fade',
  tilt: false,
  resolution: 1.5,
}

// A glass pane. The outer element is refracted; the children sit in an inner layer above it,
// so text stays sharp. The effect is removed when the component unmounts.
export function GlassSurface({ children, className, style, zIndex = 50, tint, enabled = true, options }: GlassSurfaceProps) {
  // A stable id for this pane, used to find it in the page
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const ref = useRef<HTMLDivElement>(null)
  const optionsKey = JSON.stringify(options ?? {})

  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    el.setAttribute('data-glass', uid)

    let lens: LiquidGLLens | null = null
    // Start once the page has loaded, so the snapshot is taken at the final layout
    const start = () => {
      try {
        lens = liquidGL({
        ...DEFAULTS,
        ...(options ?? {}),
        target: `[data-glass="${uid}"]`,
        content: `[data-glass-content="${uid}"]`,
        // body is the library's default and is what the working test page uses
        snapshot: options?.snapshot ?? 'body',
        zIndex,
        tint: tint ?? null,
      })
    } catch (err) {
      // Fall back to the plain surface if the effect cannot start on this device
        console.warn('Glass effect unavailable, showing the plain surface.', err)
      }
    }
    if (document.readyState === 'complete') requestAnimationFrame(start)
    else window.addEventListener('load', start)
    return () => {
      window.removeEventListener('load', start)
      lens?.destroy()
    }
    // The options object is compared by its JSON, so a new object with the same values does not rebuild the lens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, enabled, zIndex, tint, optionsKey])

  return (
    <div
      ref={ref}
      className={['relative', enabled ? '' : 'bg-[#201d18]/80 backdrop-blur-xl', className ?? ''].join(' ')}
      style={style}
    >
      <div data-glass-content={uid} className="relative z-[3] h-full w-full">
        {children}
      </div>
    </div>
  )
}