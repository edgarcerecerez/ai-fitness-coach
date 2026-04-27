import { formatPushPayload, sendPushNotificationToMany } from '../push-send'
import webpush from 'web-push'

jest.mock('web-push', () => ({
  __esModule: true,
  default: {
    setVapidDetails: jest.fn(),
    sendNotification: jest.fn(),
  },
}))

describe('formatPushPayload', () => {
  it('fills required defaults when only a title is provided', () => {
    const formatted = formatPushPayload({ title: 'Hello' })
    expect(formatted).toEqual({
      title: 'Hello',
      body: '',
      url: '/',
      icon: undefined,
      badge: undefined,
      tag: undefined,
      data: { url: '/' },
    })
  })

  it('mirrors the url onto data so the SW notificationclick has it', () => {
    const formatted = formatPushPayload({
      title: 'Reminder',
      body: 'Time to log lunch',
      url: '/calorie-tracker',
    })
    expect(formatted.url).toBe('/calorie-tracker')
    expect(formatted.data.url).toBe('/calorie-tracker')
  })

  it('preserves caller-provided icon, badge, tag and data', () => {
    const formatted = formatPushPayload({
      title: 'Weekly summary',
      body: '...',
      url: '/analytics',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge.png',
      tag: 'weekly-summary',
      data: { kind: 'summary', week: 17 },
    })
    expect(formatted.icon).toBe('/icons/icon-192.png')
    expect(formatted.badge).toBe('/icons/badge.png')
    expect(formatted.tag).toBe('weekly-summary')
    expect(formatted.data).toEqual({
      kind: 'summary',
      week: 17,
      url: '/analytics',
    })
  })

  it('lets caller-provided data.url be overridden by top-level url', () => {
    const formatted = formatPushPayload({
      title: 'X',
      url: '/profile',
      data: { url: '/should-be-overridden', other: true },
    })
    expect(formatted.data.url).toBe('/profile')
    expect(formatted.data.other).toBe(true)
  })

  it('throws when title is missing or empty', () => {
    expect(() =>
      formatPushPayload({ title: '' as unknown as string })
    ).toThrow(/title/)
    expect(() =>
      formatPushPayload({} as unknown as { title: string })
    ).toThrow(/title/)
  })

  it('produces JSON-serializable output suitable for web-push', () => {
    const formatted = formatPushPayload({ title: 'Ping', body: 'pong' })
    expect(() => JSON.stringify(formatted)).not.toThrow()
    const parsed = JSON.parse(JSON.stringify(formatted))
    expect(parsed.title).toBe('Ping')
    expect(parsed.body).toBe('pong')
  })

  it('trims whitespace-only titles and rejects them', () => {
    expect(() => formatPushPayload({ title: '   ' })).toThrow(/title/)
  })

  it('trims surrounding whitespace from valid titles', () => {
    const formatted = formatPushPayload({ title: '  Hello  ' })
    expect(formatted.title).toBe('Hello')
  })
})

describe('sendPushNotificationToMany bounded concurrency', () => {
  const ORIGINAL_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const ORIGINAL_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY

  beforeAll(() => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public-key'
    process.env.VAPID_PRIVATE_KEY = 'test-private-key'
  })

  afterAll(() => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = ORIGINAL_PUBLIC_KEY
    process.env.VAPID_PRIVATE_KEY = ORIGINAL_PRIVATE_KEY
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('never has more than `concurrency` sends in flight at once', async () => {
    let inFlight = 0
    let maxInFlight = 0

    ;(webpush.sendNotification as jest.Mock).mockImplementation(async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      // Yield a few times to let the scheduler interleave starts.
      await new Promise((resolve) => setTimeout(resolve, 10))
      inFlight -= 1
      return { statusCode: 201 }
    })

    const subs = Array.from({ length: 5 }, (_, i) => ({
      endpoint: `https://example.com/${i}`,
      p256dh: 'p',
      auth: 'a',
    }))

    const results = await sendPushNotificationToMany(
      subs,
      { title: 'Hi' },
      2
    )

    expect(results).toHaveLength(5)
    expect(results.every((r) => r.success)).toBe(true)
    expect(results.map((r) => r.endpoint)).toEqual(
      subs.map((s) => s.endpoint)
    )
    expect(maxInFlight).toBeLessThanOrEqual(2)
    expect(maxInFlight).toBeGreaterThan(0)
  })

  it('records per-send failures without aborting the batch', async () => {
    ;(webpush.sendNotification as jest.Mock).mockImplementation(
      async (sub: { endpoint: string }) => {
        if (sub.endpoint.endsWith('/2')) {
          throw Object.assign(new Error('gone'), { statusCode: 410 })
        }
        return { statusCode: 201 }
      }
    )

    const subs = Array.from({ length: 4 }, (_, i) => ({
      endpoint: `https://example.com/${i}`,
      p256dh: 'p',
      auth: 'a',
    }))

    const results = await sendPushNotificationToMany(
      subs,
      { title: 'Hi' },
      2
    )

    expect(results).toHaveLength(4)
    const failed = results.find((r) => r.endpoint.endsWith('/2'))
    expect(failed?.success).toBe(false)
    expect(failed?.statusCode).toBe(410)
    expect(failed?.error).toBe('gone')
    expect(results.filter((r) => r.success)).toHaveLength(3)
  })
})
