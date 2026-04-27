 
/**
 * AI Fitness Coach service worker.
 *
 * - Pre-caches the offline fallback shell on install.
 * - Uses a stale-while-revalidate cache for static assets (JS, CSS, images, fonts).
 * - Falls back to /offline.html for navigation requests when the network is unavailable.
 * - Handles incoming push events and notification click navigation.
 */

const CACHE_VERSION = 'v1'
const STATIC_CACHE = `static-${CACHE_VERSION}`
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`
const OFFLINE_URL = '/offline.html'

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

function isStaticAsset(request) {
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return false
  return /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(
    url.pathname
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return

  // Navigation requests: network first, fall back to cached offline shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request)
        } catch {
          const cache = await caches.open(STATIC_CACHE)
          const cached = await cache.match(OFFLINE_URL)
          return cached ?? Response.error()
        }
      })()
    )
    return
  }

  // Static assets: stale-while-revalidate.
  if (isStaticAsset(request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE)
        const cached = await cache.match(request)
        const networkPromise = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone())
            }
            return response
          })
          .catch(() => cached ?? Response.error())
        // Keep the SW alive until the background cache update finishes,
        // even when we serve the cached response immediately.
        event.waitUntil(networkPromise)
        return cached ?? networkPromise
      })()
    )
  }
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'AI Fitness Coach', body: event.data.text() }
  }
  const title = payload.title || 'AI Fitness Coach'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    data: payload.data || { url: payload.url || '/' },
    tag: payload.tag,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const rawTargetUrl =
    (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    (async () => {
      // Sanitize the URL to prevent open-redirect: only allow same-origin
      // navigations; anything else falls back to '/'.
      let parsed
      try {
        parsed = new URL(rawTargetUrl, self.location.origin)
      } catch {
        parsed = new URL('/', self.location.origin)
      }
      if (parsed.origin !== self.location.origin) {
        parsed = new URL('/', self.location.origin)
      }
      const safeRelativeUrl =
        parsed.pathname + parsed.search + parsed.hash
      const safeAbsoluteUrl = parsed.href

      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // Prefer focusing an existing window already on the target URL
      // rather than blindly navigating it away from the user's context.
      for (const client of clientList) {
        if (client.url === safeAbsoluteUrl && 'focus' in client) {
          return client.focus()
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(safeRelativeUrl)
      }
      return undefined
    })()
  )
})
