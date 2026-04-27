import { formatPushPayload } from '../push-send'

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
})
