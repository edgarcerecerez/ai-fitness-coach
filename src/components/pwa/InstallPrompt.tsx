'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

const DISMISSED_STORAGE_KEY = 'pwa-install-prompt-dismissed-at'
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

function recentlyDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const value = window.localStorage.getItem(DISMISSED_STORAGE_KEY)
    if (!value) return false
    const dismissedAt = Number.parseInt(value, 10)
    if (!Number.isFinite(dismissedAt)) return false
    return Date.now() - dismissedAt < DISMISS_TTL_MS
  } catch {
    return false
  }
}

/**
 * Shows a small install banner when the browser fires `beforeinstallprompt`.
 *
 * Hides itself after the user installs the app, dismisses the prompt, or
 * if it was dismissed recently (within 7 days). Renders nothing on browsers
 * that do not support the install prompt API.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (recentlyDismissed()) return

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setVisible(true)
    }
    const handleInstalled = () => {
      setVisible(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    try {
      window.localStorage.setItem(DISMISSED_STORAGE_KEY, String(Date.now()))
    } catch {
      // ignore storage errors
    }
  }

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    try {
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'dismissed') {
        // Persist the 7-day dismissal so we don't re-prompt immediately.
        dismiss()
        return
      }
    } finally {
      setDeferredPrompt(null)
      setVisible(false)
    }
  }

  if (!visible || !deferredPrompt) return null

  return (
    <div
      role="dialog"
      aria-label="Install AI Fitness Coach"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-lg border bg-background p-4 shadow-lg sm:inset-x-auto sm:right-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Install AI Fitness Coach</p>
          <p className="text-xs text-muted-foreground">
            Add to your home screen for faster access and offline support.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={install}>
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
