import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { LiquidGlass, type LiquidGlassInstance } from '@ybouane/liquidglass'
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

interface DragState {
  px: number // pointer position where the drag started
  py: number
  x: number // footer position where the drag started
  y: number
  w: number
  h: number
  home: boolean // true if the footer was in its normal place, not already floating
  lx: number // latest pointer position, applied once per frame
  ly: number
}

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
  const drag = useRef<DragState | null>(null)
  const frame = useRef<number | undefined>(undefined)
  const snapTimer = useRef<number | undefined>(undefined)
  const glassRef = useRef<LiquidGlassInstance | null>(null)
  const outsideRef = useRef(false)
  const frozenRef = useRef<HTMLElement | null>(null)

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
          else {
            instance = i
            glassRef.current = i
          }
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
      glassRef.current = null
    }
  }, [liquid])

  const isInside = (x: number, y: number, w: number, h: number) => {
    const p = rootRef.current?.getBoundingClientRect()
    if (!p) return true
    const cx = x + w / 2
    const cy = y + h / 2
    return cx >= p.left && cx <= p.right && cy >= p.top && cy <= p.bottom
  }

  // Outside the panel the glass has nothing to bend, so the footer shows a dark surface instead
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

  // The backing moves with the footer, by transform, so it costs no layout work
  const showBacking = (on: boolean, dx = 0, dy = 0) => {
    const b = backingRef.current
    if (!b) return
    b.style.display = on ? 'block' : 'none'
    b.style.transform = `translate3d(${dx}px,${dy}px,0)`
  }

  // Only acts when the box crosses the panel edge, not on every move
  const updateOutside = (outside: boolean, dx = 0, dy = 0) => {
    if (!liquid) return
    const wasOutside = outsideRef.current
    outsideRef.current = outside
    setOutsideLook(outside)
    showBacking(outside, dx, dy)
    // Back over the messages: the glass was switched off while outside, so ask it to redraw
    if (wasOutside && !outside) glassRef.current?.markChanged(footRef.current ?? undefined)
  }

  // While the footer is being dragged, the messages behind it don't change. So they are captured
  // once, not on every frame. They are captured again when the drag ends.
  const freezeBackdrop = () => {
    const vp = rootRef.current?.querySelector<HTMLElement>('[data-dynamic]') ?? null
    if (vp) {
      vp.removeAttribute('data-dynamic')
      frozenRef.current = vp
    }
  }
  const thawBackdrop = () => {
    const vp = frozenRef.current
    if (vp) {
      vp.setAttribute('data-dynamic', '')
      frozenRef.current = null
    }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const foot = footRef.current
    if (!foot || e.button !== 0) return
    const t = e.target as HTMLElement
    if (!t.closest('[data-drag-handle]') || t.closest('button, textarea, input, select, a')) return
    window.clearTimeout(snapTimer.current)

    const home = !foot.style.position
    const r = foot.getBoundingClientRect()
    drag.current = {
      px: e.clientX, py: e.clientY, x: r.left, y: r.top, w: r.width, h: r.height, home,
      lx: e.clientX, ly: e.clientY,
    }
    foot.setPointerCapture(e.pointerId)
    Object.assign(foot.style, {
      position: 'fixed', left: r.left + 'px', top: r.top + 'px',
      width: r.width + 'px', height: r.height + 'px',
      right: 'auto', bottom: 'auto', transition: 'none', transform: '', zIndex: '80',
    })
    const b = backingRef.current
    if (b) Object.assign(b.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', transform: '', display: 'none' })
    freezeBackdrop()
  }

  // Applies the latest pointer position, at most once per screen frame
  const applyMove = () => {
    frame.current = undefined
    const d = drag.current
    const foot = footRef.current
    if (!d || !foot) return
    const dx = d.lx - d.px
    const dy = d.ly - d.py
    foot.style.transform = `translate3d(${dx}px,${dy}px,0)`
    if (liquid) updateOutside(!isInside(d.x + dx, d.y + dy, d.w, d.h), dx, dy)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    d.lx = e.clientX
    d.ly = e.clientY
    if (frame.current === undefined) frame.current = requestAnimationFrame(applyMove)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const foot = footRef.current
    if (!d || !foot) return
    drag.current = null
    if (frame.current !== undefined) {
      cancelAnimationFrame(frame.current)
      frame.current = undefined
    }
    thawBackdrop()

    const dx = e.clientX - d.px
    const dy = e.clientY - d.py
    const x = d.x + dx
    const y = d.y + dy

    if (Math.abs(dx) < SNAP_DISTANCE && Math.abs(dy) < SNAP_DISTANCE) {
      // Glide back to where the drag started, then return to the normal layout if it started there
      foot.style.transition = 'transform 200ms ease-out'
      foot.style.transform = ''
      updateOutside(false)
      snapTimer.current = window.setTimeout(() => {
        if (d.home) foot.removeAttribute('style')
        else foot.style.transition = 'none'
      }, 200)
      return
    }

    // Commit the new position, and drop the transform
    foot.style.left = x + 'px'
    foot.style.top = y + 'px'
    foot.style.transform = ''
    const b = backingRef.current
    if (b) {
      b.style.left = x + 'px'
      b.style.top = y + 'px'
    }
    updateOutside(liquid && !isInside(x, y, d.w, d.h))
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