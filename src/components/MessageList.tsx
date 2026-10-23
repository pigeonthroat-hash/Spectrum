import { useLayoutEffect, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent, type WheelEvent as ReactWheelEvent } from 'react'

const ESTIMATE = 80   // height used for a message until it has been measured
const GAP = 24        // space between messages (matches the old space-y-6)
const TOP = 12        // space above the first message (matches the old p-3)
const OVERSCAN = 240  // px drawn above and below the visible area, so scrolling never shows a gap
const NEAR = 60       // px from the bottom that still counts as "at the bottom"

interface MessageListProps<T extends { id: string }> {
  items: T[]
  // space under the last message, so the footer never covers it
  bottomPad: number
  renderItem: (item: T, index: number) => ReactNode
}

// The chat messages with our own scroll. The browser never scrolls this: the wheel and touch
// move a track, and only the messages that can be seen are drawn.
export function MessageList<T extends { id: string }>({ items, bottomPad, renderItem }: MessageListProps<T>) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const heights = useRef(new Map<string, number>())
  const itemsRef = useRef(items)
  itemsRef.current = items
  const bottomRef = useRef(bottomPad)
  bottomRef.current = bottomPad
  const scrollRef = useRef(0)
  const stick = useRef(true)          // follow the bottom: new messages and streaming replies stay in view
  const prevCount = useRef(items.length)
  const touchY = useRef<number | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const [scroll, setScroll] = useState(0)
  const [viewH, setViewH] = useState(0)
  const [, setTick] = useState(0) // re-draw when a height is measured

  // Where every message starts, from the measured heights (or the estimate for new ones)
  const layout = (list: T[], bottom: number) => {
    const offsets: number[] = []
    let y = TOP
    for (const it of list) {
      offsets.push(y)
      y += (heights.current.get(it.id) ?? ESTIMATE) + GAP
    }
    return { offsets, total: y + bottom }
  }

  const maxScroll = (bottom: number) =>
    Math.max(0, layout(itemsRef.current, bottom).total - (viewportRef.current?.clientHeight ?? 0))

  const setScrollTo = (v: number) => {
    scrollRef.current = v
    setScroll(v)
  }

  const scrollToBottom = () => setScrollTo(maxScroll(bottomRef.current))

  const moveBy = (dy: number) => {
    const max = maxScroll(bottomRef.current)
    const next = Math.min(max, Math.max(0, scrollRef.current + dy))
    stick.current = max - next <= NEAR
    setScrollTo(next)
  }

  // Measure each drawn message. When one changes size (a reply streaming in), keep the bottom in view.
  useLayoutEffect(() => {
    if (!observer.current) {
      observer.current = new ResizeObserver((entries) => {
        let changed = false
        for (const e of entries) {
          const el = e.target as HTMLElement
          const id = el.dataset.id
          if (!id) continue
          const h = Math.ceil(el.getBoundingClientRect().height)
          if (heights.current.get(id) !== h) {
            heights.current.set(id, h)
            changed = true
          }
        }
        if (changed) {
          setTick((t) => t + 1)
          if (stick.current) scrollToBottom()
        }
      })
    }
    const obs = observer.current
    obs.disconnect()
    trackRef.current?.querySelectorAll<HTMLElement>('[data-id]').forEach((el) => obs.observe(el))
  })

  // The visible height of the list: when it changes (for example the panel is resized), keep the view right
  useLayoutEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const update = () => {
      setViewH(vp.clientHeight)
      if (stick.current) scrollToBottom()
      else setScrollTo(Math.min(scrollRef.current, maxScroll(bottomRef.current)))
    }
    const obs = new ResizeObserver(update)
    obs.observe(vp)
    update()
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A new message is always followed. The footer's height changing keeps the bottom in view too.
  useLayoutEffect(() => {
    if (items.length > prevCount.current) stick.current = true
    prevCount.current = items.length
    if (stick.current) scrollToBottom()
    else setScrollTo(Math.min(scrollRef.current, maxScroll(bottomPad)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, bottomPad])

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    moveBy(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY)
  }
  const onTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    touchY.current = e.touches[0].clientY
  }
  const onTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (touchY.current === null) return
    const y = e.touches[0].clientY
    moveBy(touchY.current - y)
    touchY.current = y
  }
  const onTouchEnd = () => {
    touchY.current = null
  }

  const { offsets, total } = layout(items, bottomPad)
  const visibleTop = scroll - OVERSCAN
  const visibleBottom = scroll + viewH + OVERSCAN
  let from = 0
  while (from < items.length && offsets[from] + (heights.current.get(items[from].id) ?? ESTIMATE) < visibleTop) from++
  let to = from
  while (to < items.length && offsets[to] <= visibleBottom) to++

  const drawn: ReactNode[] = []
  for (let i = from; i < to; i++) {
    const it = items[i]
    drawn.push(
      <div key={it.id} data-id={it.id} className="absolute left-0 right-0 px-3" style={{ top: offsets[i] }}>
        {renderItem(it, i)}
      </div>
    )
  }

  return (
    <div
      ref={viewportRef}
      data-dynamic
      className="absolute inset-0 overflow-hidden"
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div ref={trackRef} className="absolute left-0 right-0 top-0" style={{ height: total, transform: `translateY(${-scroll}px)` }}>
        {drawn}
      </div>
    </div>
  )
}