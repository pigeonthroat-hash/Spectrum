import type { PointerEvent as ReactPointerEvent } from 'react'
import { useDragStore, type DragItem } from './dragStore'

const THRESHOLD_PX = 5
let suppressClick = false

// Lets click handlers ignore the click that ends a drag
export function clickWasDrag(): boolean {
  return suppressClick
}

// Starts a drag once the pointer moves a little. Escape cancels.
// onMove runs on every move. onDrop runs only when the pointer is released over a target.
export function beginPointerDrag(
  e: ReactPointerEvent,
  makeItem: () => DragItem,
  onMove: (x: number, y: number) => void,
  onDrop: () => void
) {
  if (e.button !== 0) return
  const startX = e.clientX
  const startY = e.clientY
  let active = false

  const finish = (drop: boolean) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
    window.removeEventListener('keydown', key)
    document.body.style.userSelect = ''
    if (!active) return
    suppressClick = true
    window.setTimeout(() => {
      suppressClick = false
    }, 0)
    if (drop) onDrop()
    useDragStore.getState().clear()
  }

  const move = (ev: PointerEvent) => {
    if (!active) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESHOLD_PX) return
      active = true
      document.body.style.userSelect = 'none'
      useDragStore.getState().start(makeItem(), ev.clientX, ev.clientY)
    }
    useDragStore.getState().setPointer(ev.clientX, ev.clientY)
    onMove(ev.clientX, ev.clientY)
  }

  const up = () => finish(true)
  const cancel = () => finish(false)
  const key = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') finish(false)
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancel)
  window.addEventListener('keydown', key)
}