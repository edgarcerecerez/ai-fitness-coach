/**
 * Shared definition of the protected app navigation links.
 *
 * Centralizing the list keeps the desktop bar, mobile drawer, and any future
 * surfaces (sidebar, command palette, etc.) consistent and unit-testable.
 */

export interface NavLink {
  href: string
  label: string
}

export const NAV_LINKS: readonly NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calorie-tracker", label: "Calorie Tracker" },
  { href: "/calorie-tracker/dashboard", label: "Calorie Dashboard" },
  { href: "/analytics", label: "Analytics" },
  { href: "/profile", label: "Profile" },
] as const

/**
 * Returns the nav links for use in components. A function (rather than the
 * raw const) makes it easy to mock or filter per-environment in the future.
 */
export function getNavLinks(): readonly NavLink[] {
  return NAV_LINKS
}

/**
 * Determines whether a nav link should be marked active for a given pathname.
 *
 * Exact match wins; otherwise we treat the link as active when the current
 * pathname is nested under it (e.g. `/profile/edit` is active for `/profile`).
 * The root dashboard link only activates on an exact match so it doesn't
 * highlight for every nested route.
 */
export function isActiveLink(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (pathname === href) return true
  if (href === "/dashboard") return false
  // Avoid `/calorie-tracker` swallowing `/calorie-tracker/dashboard` — the
  // longer link still wins because exact match is checked first above.
  return pathname.startsWith(`${href}/`)
}

/**
 * Builds two-letter initials for an avatar from an email address.
 * Returns "?" when the email is missing or unparseable.
 */
export function getEmailInitials(email: string | null | undefined): string {
  if (!email) return "?"
  const local = email.split("@")[0] ?? ""
  const parts = local.split(/[._-]+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
