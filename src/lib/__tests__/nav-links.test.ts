import { describe, it, expect } from '@jest/globals'
import {
  NAV_LINKS,
  getNavLinks,
  isActiveLink,
  getEmailInitials,
} from '../nav-links'

describe('nav-links', () => {
  describe('getNavLinks', () => {
    it('returns the canonical link list', () => {
      const links = getNavLinks()
      expect(links).toBe(NAV_LINKS)
      expect(links.map((l) => l.href)).toEqual([
        '/dashboard',
        '/calorie-tracker',
        '/calorie-tracker/dashboard',
        '/analytics',
        '/profile',
      ])
    })
  })

  describe('isActiveLink', () => {
    const ALL_HREFS = NAV_LINKS.map((l) => l.href)

    it('returns false when pathname is null', () => {
      expect(isActiveLink(null, '/dashboard', ALL_HREFS)).toBe(false)
    })

    it('matches exact paths', () => {
      expect(isActiveLink('/profile', '/profile', ALL_HREFS)).toBe(true)
    })

    it('matches nested paths under a non-dashboard link', () => {
      expect(isActiveLink('/profile/edit', '/profile', ALL_HREFS)).toBe(true)
    })

    it('does not let an ancestor nav link activate when the current pathname has its own nav entry', () => {
      // `/calorie-tracker/dashboard` is itself in the nav, so `/calorie-tracker`
      // must NOT also light up.
      expect(
        isActiveLink('/calorie-tracker/dashboard', '/calorie-tracker', ALL_HREFS)
      ).toBe(false)
      expect(
        isActiveLink('/calorie-tracker/dashboard', '/calorie-tracker/dashboard', ALL_HREFS)
      ).toBe(true)
    })

    it('does not let dashboard link match every route', () => {
      expect(isActiveLink('/profile', '/dashboard', ALL_HREFS)).toBe(false)
      expect(isActiveLink('/dashboard', '/dashboard', ALL_HREFS)).toBe(true)
    })

    it('does not match unrelated paths', () => {
      expect(isActiveLink('/analytics', '/profile', ALL_HREFS)).toBe(false)
    })

    it('does not match similarly-named prefixes that are not nested', () => {
      // `/calorie-tracker-x` should NOT activate `/calorie-tracker`
      expect(isActiveLink('/calorie-tracker-x', '/calorie-tracker', ALL_HREFS)).toBe(false)
    })

    it('defaults navHrefs to an empty list when omitted', () => {
      // Omitting navHrefs preserves prefix-match behavior.
      expect(isActiveLink('/profile/edit', '/profile')).toBe(true)
    })
  })

  describe('getEmailInitials', () => {
    it('returns ? for missing input', () => {
      expect(getEmailInitials(undefined)).toBe('?')
      expect(getEmailInitials(null)).toBe('?')
      expect(getEmailInitials('')).toBe('?')
    })

    it('uses first two chars for a single-token local-part', () => {
      expect(getEmailInitials('alice@example.com')).toBe('AL')
    })

    it('combines first chars of multi-token local-parts', () => {
      expect(getEmailInitials('jane.doe@example.com')).toBe('JD')
      expect(getEmailInitials('jane_doe@example.com')).toBe('JD')
      expect(getEmailInitials('jane-doe@example.com')).toBe('JD')
    })
  })
})
