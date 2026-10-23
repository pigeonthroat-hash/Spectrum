import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { LiquidGlass } from '@ybouane/liquidglass'
import type { ChatStyle } from '../store/useAppStore'
import { cn } from '../lib/utils'

// The library's defaults, except the two shape values, which fit our short footer
const GLASS_CONFIG = {
  blurAmount: 0,
  refraction: 0.45,
  chromAberration: 0.02,
  edgeHighlight: 0.05,
  specular: 0,
  fresnel: 1,
  cornerRadius: 24,
  zRadius: 14,
  shadowOpacity: 0.2,
  shadowSpread: 0,
  shadowOffsetY: 2,
  brightness: 0,
  saturation: 0,
  bevelMode: 0,
}

const SNAP_DISTANCE = 40

interface ChatBodyProps {
  hidden: boolean
  style: ChatStyle
  // the message list; it gets the space the footer needs at the bottom
  list: (bottomPad: number) => ReactNode
  footer: ReactNode
}

// The chat panel body. The messages and the footer are both inside this root, so in Liquid mode
// the glass bends the messages behind the footer. The footer can be dragged anywhere on screen.
export function ChatBody({ hidden, style, list, footer }: ChatBodyProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const footRef = useRef<HTMLDivElement>(null)
  const backingRef = useRef<HTMLDivElement>(null)
  const liquid = style === 'liquid'
  const [footH, setFootH] = useState(96)
  const drag = useRef<{ px: number; py: number; x: number; y: number; w: number; h: number; ox: number; oy: number } | null>(null)
  const snapTimer = useRef<number | undefined>(undefined)

  // The footer's height, so the messages scroll above it
  useLayoutEffect(() => {
    const foot = footRef.current
    if (!foot) return
    const ro = new ResizeObserver(() => setFootH(foot.offsetHeight))
    ro.observe(foot)
    setFootH(foot.offsetHeight)
    return () => ro.disconnect()
  }, [])

  // The glass: on in Liquid mode. It restarts when the panel changes size, because the library
  // only watches the window.
  useEffect(() => {
    const root = rootRef.current
    const foot = footRef.current
    if (!liquid || !root || !foot) return
    let instance: { destroy: () => void } | null = null
    let cancelled = false
    let generation = 0
    let timer: number | undefined

    const start = () => {
      const mine = ++generation
      LiquidGlass.init({ root, glassElements: [foot] })
        .then((i) => {
          if (cancelled || mine !== generation) i.destroy()
          else instance = i
        })
        .catch((err: unknown) => console.warn('Liquid glass failed to start, showing plain footer', err))
    }
    start()

    let first = true
    const observer = new ResizeObserver(() => {
      if (first) {
        first = false
        return
      }
      // Switch the glass off while the panel changes size, so it moves smoothly, then bring it back
      instance?.destroy()
      instance = null
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (!cancelled) start()
      }, 200)
    })
    observer.observe(root)

    return () => {
      cancelled = true
      observer.disconnect()
      window.clearTimeout(timer)
      instance?.destroy()
    }
  }, [liquid])

  // Dragging: only the footer's drag handle starts a drag. Buttons and the text box keep working.
  const isInside = (x: number, y: number, w: number, h: number) => {
    const p = rootRef.current?.getBoundingClientRect()
    if (!p) return true
    const cx = x + w / 2
    const cy = y + h / 2
    return cx >= p.left && cx <= p.right && cy >= p.top && cy <= p.bottom
  }

  // Outside the panel the glass has nothing to bend, so its canvas would paint white. Hide the canvas
  // there, and give the footer a dark surface with a faint glass rim instead.
  const setOutsideLook = (outside: boolean) => {
    const foot = footRef.current
    if (!foot) return
    foot.querySelectorAll<HTMLCanvasElement>(':scope > canvas').forEach((c) => {
      c.style.opacity = outside ? '0' : ''
    })
    foot.style.background = outside ? 'rgba(26,24,20,0.92)' : ''
    foot.style.boxShadow = outside ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.35)' : ''
    foot.style.border = outside ? '1px solid rgba(255,255,255,0.06)' : ''
  }

  const showBacking = (on: boolean, x = 0, y = 0, w = 0, h = 0) => {
    const b = backingRef.current
    if (liquid) setOutsideLook(on)
    if (!b) return
    if (!on) {
      b.style.display = 'none'
      return
    }
    Object.assign(b.style, { display: 'block', left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' })
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const foot = footRef.current
    if (!foot || e.button !== 0) return
    const t = e.target as HTMLElement
    if (!t.closest('[data-drag-handle]') || t.closest('button, textarea, input, select, a')) return
    window.clearTimeout(snapTimer.current)
    const r = foot.getBoundingClientRect()
    drag.current = { px: e.clientX, py: e.clientY, x: r.left, y: r.top, w: r.width, h: r.height, ox: r.left, oy: r.top }
    foot.setPointerCapture(e.pointerId)
    Object.assign(foot.style, {
      position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px',
      right: 'auto', bottom: 'auto', transition: 'none', zIndex: '80',
    })
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const foot = footRef.current
    if (!d || !foot) return
    const x = d.x + e.clientX - d.px
    const y = d.y + e.clientY - d.py
    foot.style.left = x + 'px'
    foot.style.top = y + 'px'
    if (liquid) showBacking(!isInside(x, y, d.w, d.h), x, y, d.w, d.h)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const foot = footRef.current
    if (!d || !foot) return
    drag.current = null
    const x = d.x + e.clientX - d.px
    const y = d.y + e.clientY - d.py
    if (Math.abs(x - d.ox) < SNAP_DISTANCE && Math.abs(y - d.oy) < SNAP_DISTANCE) {
      // Glide back to where it started, then return to its place in the panel
      foot.style.transition = 'left 200ms ease-out, top 200ms ease-out'
      foot.style.left = d.ox + 'px'
      foot.style.top = d.oy + 'px'
      showBacking(false)
      snapTimer.current = window.setTimeout(() => foot.removeAttribute('style'), 200)
    } else if (liquid && !isInside(x, y, d.w, d.h)) {
      // Dropped outside: keep the dark backing under the glass
      showBacking(true, x, y, d.w, d.h)
    } else {
      showBacking(false)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative flex-1 min-h-0 overflow-hidden', hidden && 'hidden')}>
      {/* The library ignores the root's own background, so the chat's colour lives in this sibling.
          Without it, the glass has nothing to bend and shows up white. */}
      <div aria-hidden className="absolute inset-0 bg-[#1a1814] pointer-events-none" />
      {list(footH + 24)}

      <div
        ref={footRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        data-config={liquid ? JSON.stringify(GLASS_CONFIG) : undefined}
        className={cn(
          'absolute left-3 right-3 bottom-3 z-[1] isolate',
          liquid
            ? 'rounded-[24px] px-2.5 py-2'
            : 'rounded-xl border border-[#2a261f] bg-[#1f1b15] px-3 py-2.5 shadow-sm'
        )}
      >
        {footer}
      </div>

      {liquid &&
        createPortal(
          <div
            ref={backingRef}
            className="fixed hidden z-[79] pointer-events-none rounded-[24px] bg-[#1a1814]/90"
          />,
          document.body
        )}
    </div>
  )
}