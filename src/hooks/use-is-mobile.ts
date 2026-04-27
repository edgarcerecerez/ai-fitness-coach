'use client'

import { useEffect, useState } from 'react'

const MOBILE_QUERY = '(max-width: 768px)'

/**
 * Returns `true` when the viewport matches a mobile breakpoint
 * (`(max-width: 768px)`). Returns `false` during SSR and on browsers without
 * `matchMedia`, then updates after hydration.
 *
 * @param query - Optional override for the media query.
 */
export function useIsMobile(query: string = MOBILE_QUERY): boolean {
  const [isMobile, setIsMobile] = useState(false)

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
