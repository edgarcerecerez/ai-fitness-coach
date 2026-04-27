import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'

jest.mock('@/utils/supabase/server')
jest.mock('@/lib/logger', () => ({
  apiLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}))

// Importing the route after mocks are registered.
const { GET } = require('../route')
const { createClient } = require('@/utils/supabase/server')

interface QueryRecorder {
  table?: string
  gte?: { column: string; value: string }
  lte?: { column: string; value: string }
}

function buildSupabaseMock(options: {
  user?: { id: string } | null
  authError?: Error | null
  data?: Record<string, unknown[]>
  errorOnTable?: string
}) {
  const queries: QueryRecorder[] = []
  const data = options.data ?? {}

  return {
    queries,
    client: {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: options.user === undefined ? { id: 'user-123' } : options.user },
          error: options.authError ?? null,
        }),
      },
      from: jest.fn((table: string) => {
        const q: QueryRecorder = { table }
        queries.push(q)
        const builder: Record<string, unknown> = {}
        builder.select = jest.fn(() => builder)
        builder.order = jest.fn(() => builder)
        builder.gte = jest.fn((column: string, value: string) => {
          q.gte = { column, value }
          return builder
        })
        builder.lte = jest.fn((column: string, value: string) => {
          q.lte = { column, value }
          return builder
        })
        builder.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve(
            resolve({
              data: data[table] ?? [],
              error: options.errorOnTable === table ? new Error('boom') : null,
            })
          )
        return builder
      }),
    },
  }
}

describe('GET /api/analytics/export', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    const mock = buildSupabaseMock({ user: null, authError: new Error('no session') })
    createClient.mockResolvedValue(mock.client)

    const res = await GET(new NextRequest('http://localhost/api/analytics/export'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('rejects unsupported formats', async () => {
    const mock = buildSupabaseMock({})
    createClient.mockResolvedValue(mock.client)

    const res = await GET(
      new NextRequest('http://localhost/api/analytics/export?format=xml')
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Unsupported format')
  })

  it('rejects malformed start date', async () => {
    const mock = buildSupabaseMock({})
    createClient.mockResolvedValue(mock.client)

    const res = await GET(
      new NextRequest('http://localhost/api/analytics/export?start=01-01-2026')
    )
    expect(res.status).toBe(400)
  })

  it('returns JSON payload by default with the correct headers and data', async () => {
    const mock = buildSupabaseMock({
      data: {
        weight_logs: [
          { id: 'w1', recorded_at: '2026-01-01T00:00:00Z', weight_kg: 80 },
        ],
        nutrition_logs: [
          { id: 'n1', recorded_at: '2026-01-01T12:00:00Z', total_calories: 1800 },
        ],
        mood_logs: [
          { id: 'm1', recorded_at: '2026-01-01T22:00:00Z', mood_score: 7 },
        ],
      },
    })
    createClient.mockResolvedValue(mock.client)

    const res = await GET(new NextRequest('http://localhost/api/analytics/export'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="health-export-.*\.json"$/)

    const body = JSON.parse(await res.text())
    expect(body.user_id).toBe('user-123')
    expect(body.weight_logs).toHaveLength(1)
    expect(body.nutrition_logs).toHaveLength(1)
    expect(body.mood_logs).toHaveLength(1)
  })

  it('passes start/end as ISO bounds to the underlying query', async () => {
    const mock = buildSupabaseMock({})
    createClient.mockResolvedValue(mock.client)

    const res = await GET(
      new NextRequest(
        'http://localhost/api/analytics/export?format=json&start=2026-01-01&end=2026-01-31'
      )
    )
    expect(res.status).toBe(200)
    for (const q of mock.queries) {
      expect(q.gte).toEqual({ column: 'recorded_at', value: '2026-01-01T00:00:00.000Z' })
      expect(q.lte).toEqual({ column: 'recorded_at', value: '2026-01-31T23:59:59.999Z' })
    }
  })

  it('returns CSV when format=csv', async () => {
    const mock = buildSupabaseMock({
      data: {
        weight_logs: [
          { id: 'w1', recorded_at: '2026-01-01T00:00:00Z', weight_kg: 80, source: 'manual' },
        ],
      },
    })
    createClient.mockResolvedValue(mock.client)

    const res = await GET(
      new NextRequest('http://localhost/api/analytics/export?format=csv')
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    const text = await res.text()
    expect(text).toContain('## weight_logs')
    expect(text).toContain('"w1"')
    expect(text).toContain('"80"')
  })

  it('returns 500 if a query errors', async () => {
    const mock = buildSupabaseMock({ errorOnTable: 'mood_logs' })
    createClient.mockResolvedValue(mock.client)

    const res = await GET(new NextRequest('http://localhost/api/analytics/export'))
    expect(res.status).toBe(500)
  })
})
