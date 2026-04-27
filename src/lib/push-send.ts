/**
 * Server-side helpers for sending Web Push notifications.
 *
 * Wraps the `web-push` library so callers can send a notification by passing
 * a stored subscription (in the same shape persisted by `/api/push/subscribe`)
 * and a structured payload. VAPID keys are configured lazily from environment
 * variables on first use.
 */

import webpush, { type PushSubscription as WebPushSubscription } from 'web-push'

export interface StoredPushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushNotificationPayload {
  title: string
  body?: string
  url?: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, unknown>
}

export interface FormattedPushPayload {
  title: string
  body: string
  url: string
  icon?: string
  badge?: string
  tag?: string
  data: Record<string, unknown>
}

let vapidConfigured = false

function configureVapid(): void {
  if (vapidConfigured) return

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'

  if (!publicKey || !privateKey) {
    throw new Error(
      'Missing VAPID configuration. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.'
    )
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
}

/**
 * Normalizes a {@link PushNotificationPayload} into the JSON shape the
 * service worker expects when handling a `push` event.
 *
 * Exposed (and unit-tested) so callers can reason about the wire format
 * without sending a real notification.
 */
export function formatPushPayload(
  input: PushNotificationPayload
): FormattedPushPayload {
  if (!input.title || typeof input.title !== 'string') {
    throw new Error('Push payload requires a non-empty title.')
  }

  return {
    title: input.title,
    body: input.body ?? '',
    url: input.url ?? '/',
    icon: input.icon,
    badge: input.badge,
    tag: input.tag,
    data: { ...(input.data ?? {}), url: input.url ?? '/' },
  }
}

function toWebPushSubscription(
  sub: StoredPushSubscription
): WebPushSubscription {
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  }
}

/**
 * Sends a push notification to a single stored subscription. Returns the
 * web-push send result, or rethrows if the subscription is invalid.
 */
export async function sendPushNotification(
  subscription: StoredPushSubscription,
  payload: PushNotificationPayload
) {
  configureVapid()
  const formatted = formatPushPayload(payload)
  return webpush.sendNotification(
    toWebPushSubscription(subscription),
    JSON.stringify(formatted)
  )
}

export interface BulkSendResult {
  endpoint: string
  success: boolean
  statusCode?: number
  error?: string
}

/**
 * Sends a push notification to many subscriptions, swallowing per-target
 * failures so one bad endpoint doesn't fail the whole batch. Use the returned
 * results to identify subscriptions that should be deleted (HTTP 404 / 410).
 */
export async function sendPushNotificationToMany(
  subscriptions: StoredPushSubscription[],
  payload: PushNotificationPayload
): Promise<BulkSendResult[]> {
  configureVapid()
  const formatted = JSON.stringify(formatPushPayload(payload))

  return Promise.all(
    subscriptions.map(async (sub) => {
      try {
        const res = await webpush.sendNotification(
          toWebPushSubscription(sub),
          formatted
        )
        return {
          endpoint: sub.endpoint,
          success: true,
          statusCode: res.statusCode,
        }
      } catch (error) {
        const err = error as { statusCode?: number; message?: string }
        return {
          endpoint: sub.endpoint,
          success: false,
          statusCode: err.statusCode,
          error: err.message,
        }
      }
    })
  )
}
