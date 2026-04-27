'use client'

import { useEffect } from 'react'

/**
 * Registers the application's service worker on mount in supported browsers.
 *
 * Renders no UI. Skips registration during development to avoid HMR conflicts
 * unless the `NEXT_PUBLIC_ENABLE_SW_IN_DEV` environment variable is set.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const isDev = process.env.NODE_ENV !== 'production'
    const enabledInDev = process.env.NEXT_PUBLIC_ENABLE_SW_IN_DEV === 'true'
    if (isDev && !enabledInDev) return

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((error) => {
          // Service worker is non-critical; log without surfacing to the UI.
          console.warn('Service worker registration failed:', error)
        })
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
