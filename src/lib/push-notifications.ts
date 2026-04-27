/**
 * Browser-side helpers for managing Web Push notification subscriptions.
 *
 * These utilities run in the browser only. They wrap the standard
 * `Notification`, `ServiceWorkerRegistration` and `PushManager` APIs and
 * communicate with the app's `/api/push` endpoints to persist subscriptions
 * server-side.
 */

export interface SerializedPushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  userAgent?: string
}

export type PushPermissionState = NotificationPermission | 'unsupported'

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function getPermissionState(): PushPermissionState {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * Converts a Base64URL VAPID public key into the Uint8Array form required by
 * `PushManager.subscribe`.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData =
    typeof atob === 'function'
      ? atob(base64)
      : Buffer.from(base64, 'base64').toString('binary')
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(binary, 'binary').toString('base64')
}

export function serializeSubscription(
  subscription: PushSubscription
): SerializedPushSubscription {
  const p256dhBuffer = subscription.getKey('p256dh')
  const authBuffer = subscription.getKey('auth')

  if (
    !p256dhBuffer ||
    p256dhBuffer.byteLength === 0 ||
    !authBuffer ||
    authBuffer.byteLength === 0
  ) {
    throw new Error(
      'Push subscription is missing required p256dh/auth keys.'
    )
  }

  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(p256dhBuffer),
      auth: arrayBufferToBase64(authBuffer),
    },
    userAgent:
      typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  }
}

export async function requestPermission(): Promise<PushPermissionState> {
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

const SERVICE_WORKER_READY_TIMEOUT_MS = 3000

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null

  // Prefer an already-registered SW so we never block on `ready`.
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) return existing

  // `ready` can hang forever if no SW has been registered yet, so race it
  // against a short timeout and return null on timeout.
  return Promise.race<ServiceWorkerRegistration | null>([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), SERVICE_WORKER_READY_TIMEOUT_MS)
    ),
  ])
}

async function extractFetchErrorDetails(response: Response): Promise<string> {
  let text = ''
  try {
    text = await response.text()
  } catch {
    return `HTTP ${response.status}`
  }
  try {
    const data = JSON.parse(text) as { error?: unknown }
    if (typeof data?.error === 'string') return data.error
  } catch {
    // not JSON; fall through to raw text
  }
  return text || `HTTP ${response.status}`
}

/**
 * Requests notification permission and subscribes the current browser to the
 * push service. Persists the subscription via `/api/push/subscribe` and
 * returns the serialized payload, or `null` if push is unsupported / denied.
 */
export async function subscribeToPush(
  vapidPublicKey: string | undefined = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
): Promise<SerializedPushSubscription | null> {
  if (!isPushSupported()) return null
  if (!vapidPublicKey) {
    console.warn('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY; cannot subscribe.')
    return null
  }

  const permission = await requestPermission()
  if (permission !== 'granted') return null

  const registration = await getRegistration()
  if (!registration) return null

  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }))

  const payload = serializeSubscription(subscription)
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const detail = await extractFetchErrorDetails(response)
    throw new Error(`Failed to persist push subscription: ${detail}`)
  }
  return payload
}

/**
 * Unsubscribes the current browser from the push service and removes the
 * stored subscription via `/api/push/unsubscribe`. Returns `true` if a
 * subscription was removed.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  const registration = await getRegistration()
  if (!registration) return false

  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return false

  const response = await fetch('/api/push/unsubscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })
  if (!response.ok) {
    const detail = await extractFetchErrorDetails(response)
    throw new Error(`Failed to remove push subscription: ${detail}`)
  }
  return subscription.unsubscribe()
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const registration = await getRegistration()
  if (!registration) return null
  return registration.pushManager.getSubscription()
}
