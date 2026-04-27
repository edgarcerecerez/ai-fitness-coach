"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Brain, LogOut, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"
import {
  getNavLinks,
  getEmailInitials,
  isActiveLink,
} from "@/lib/nav-links"
import { logError } from "@/lib/logger"

interface AppNavProps {
  email: string | null
}

/**
 * Top app bar for authenticated routes. Shows the brand, primary nav links,
 * the user's email + initials avatar, and a sign-out button. Collapses to a
 * slide-over drawer below the `md` breakpoint.
 */
export default function AppNav({ email }: AppNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const links = getNavLinks()
  const initials = getEmailInitials(email)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push("/login")
      router.refresh()
    } catch (error) {
      logError(error, "Error signing out")
    } finally {
      setSigningOut(false)
      setDrawerOpen(false)
    }
  }

  const closeDrawer = () => setDrawerOpen(false)

  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">
            AI Fitness Coach
          </span>
        </Link>

        {/* Desktop nav */}
        <nav
          aria-label="Main"
          className="hidden items-center gap-1 md:flex"
        >
          {links.map((link) => {
            const active = isActiveLink(pathname, link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* User + sign out (desktop) */}
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-2">
            <div
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-xs font-semibold text-white"
            >
              {initials}
            </div>
            {email && (
              <span className="max-w-[16ch] truncate text-sm text-slate-600">
                {email}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>

        {/* Mobile menu trigger */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={closeDrawer}
          />
          {/* Panel */}
          <div className="absolute right-0 top-0 flex h-full w-72 max-w-[85%] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-base font-semibold text-slate-900">Menu</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close menu"
                onClick={closeDrawer}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <div
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-sm font-semibold text-white"
              >
                {initials}
              </div>
              {email && (
                <span className="truncate text-sm text-slate-700">{email}</span>
              )}
            </div>
            <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 py-2">
              {links.map((link) => {
                const active = isActiveLink(pathname, link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onClick={closeDrawer}
                    className={cn(
                      "block rounded-md px-3 py-2 text-base font-medium transition-colors",
                      active
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>
            <div className="border-t p-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
