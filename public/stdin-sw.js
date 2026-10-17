// Holds Python input() requests until the user types a line in the Output panel.
// The Python worker asks for a line by requesting __spectrum_stdin; this worker keeps that
// request open until the page sends the answer back. Every other request passes through untouched.
const pending = new Map()

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (!url.pathname.endsWith('/__spectrum_stdin')) return
  const id = url.searchParams.get('id') || ''
  event.respondWith(
    new Promise((resolve) => {
      pending.set(id, resolve)
    })
  )
})

self.addEventListener('message', (event) => {
  const { id, value } = event.data || {}
  const resolve = pending.get(id)
  if (!resolve) return
  pending.delete(id)
  resolve(new Response(String(value ?? ''), { headers: { 'Content-Type': 'text/plain' } }))
})