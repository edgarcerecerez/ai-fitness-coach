'use client'

import { useEffect, useState } from 'react'

const MOBILE_QUERY = '(max-width: 768px)'

/**
 * Returns `true` when the viewport matches a mobile breakpoint
 * (`(max-width: 768px)`), `false` for desktop, or `undefined` while the value
 * has not yet been determined (SSR / pre-hydration). Callers should treat
 * `undefined` as "not yet known" and avoid mounting layout-specific components
 * until it resolves, otherwise mobile users will briefly render the desktop UI.
 *
 * @param query - Optional override for the media query.
 */
export function useIsMobile(query: string = MOBILE_QUERY): boolean | undefined {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mediaQuery = window.matchMedia(query)
    const update = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(event.matches)
    }

    update(mediaQuery)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', update)
      return () => mediaQuery.removeEventListener('change', update)
    }

    // Safari < 14 fallback
    mediaQuery.addListener(update)
    return () => mediaQuery.removeListener(update)
  }, [query])

  return isMobile
}

export default useIsMobile
