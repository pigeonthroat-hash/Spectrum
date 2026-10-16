import { useEffect, useState } from 'react'

// Narrow screens (phones) use the one-panel-at-a-time layout
const QUERY = '(max-width: 767px)'

export function isMobileNow(): boolean {
  return window.matchMedia(QUERY).matches
}

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(isMobileNow)
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const update = () => setMobile(mq.matches)
    mq.addEventListener('change', update)
    update()
    return () => mq.removeEventListener('change', update)
  }, [])
  return mobile
}