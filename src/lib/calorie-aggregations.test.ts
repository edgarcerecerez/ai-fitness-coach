import { describe, it, expect } from '@jest/globals'
import {
  buildDailySeries,
  filterLogsInRange,
  getTodayTotals,
  groupLogsByDay,
  startOfLocalDay,
  endOfLocalDay,
  sumNutritionLogs,
  toLocalDateKey,
} from './calorie-aggregations'
import { NutritionLog } from './nutrition-types'

function makeLog(overrides: Partial<NutritionLog> = {}): NutritionLog {
  return {
    id: overrides.id ?? Math.random().toString(),
    user_id: 'user-1',
    food_items: [],
    total_calories: 0,
    total_protein_g: 0,
    total_carbs_g: 0,
    total_fat_g: 0,
    total_fiber_g: 0,
    logged_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('toLocalDateKey', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const date = new Date(2026, 3, 5, 14, 30) // April 5, 2026
    expect(toLocalDateKey(date)).toBe('2026-04-05')
  })

  it('zero-pads months and days', () => {
    const date = new Date(2026, 0, 1)
    expect(toLocalDateKey(date)).toBe('2026-01-01')
  })
})

describe('startOfLocalDay / endOfLocalDay', () => {
  it('returns midnight for startOfLocalDay', () => {
    const date = new Date(2026, 3, 5, 14, 30, 45, 123)
    const start = startOfLocalDay(date)
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getSeconds()).toBe(0)
    expect(start.getMilliseconds()).toBe(0)
    expect(start.getDate()).toBe(5)
  })

  it('returns 23:59:59.999 for endOfLocalDay', () => {
    const date = new Date(2026, 3, 5, 14, 30)
    const end = endOfLocalDay(date)
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
    expect(end.getSeconds()).toBe(59)
    expect(end.getMilliseconds()).toBe(999)
  })

  it('does not mutate the input date', () => {
    const date = new Date(2026, 3, 5, 14, 30)
    const original = date.getTime()
    startOfLocalDay(date)
    endOfLocalDay(date)
    expect(date.getTime()).toBe(original)
  })
})

describe('sumNutritionLogs', () => {
  it('returns zeros for empty array', () => {
    expect(sumNutritionLogs([])).toEqual({
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
    })
  })

  it('sums macros across multiple logs', () => {
    const logs = [
      makeLog({
        total_calories: 500,
        total_protein_g: 20,
        total_carbs_g: 50,
        total_fat_g: 15,
        total_fiber_g: 5,
      }),
      makeLog({
        total_calories: 300,
        total_protein_g: 10,
        total_carbs_g: 30,
        total_fat_g: 8,
        total_fiber_g: 3,
      }),
    ]
    expect(sumNutritionLogs(logs)).toEqual({
      calories: 800,
      protein_g: 30,
      carbs_g: 80,
      fat_g: 23,
      fiber_g: 8,
    })
  })

  it('coerces undefined/null fields to zero', () => {
    const logs = [
      makeLog({
        total_calories: 100,
        total_protein_g: undefined as unknown as number,
        total_fiber_g: null as unknown as number,
      }),
    ]
    const totals = sumNutritionLogs(logs)
    expect(totals.calories).toBe(100)
    expect(totals.protein_g).toBe(0)
    expect(totals.fiber_g).toBe(0)
  })
})

describe('filterLogsInRange', () => {
  it('includes logs at the boundaries', () => {
    const start = new Date(2026, 3, 5, 0, 0, 0, 0)
    const end = new Date(2026, 3, 5, 23, 59, 59, 999)
    const logs = [
      makeLog({ id: 'a', logged_at: start.toISOString() }),
      makeLog({ id: 'b', logged_at: end.toISOString() }),
      makeLog({
        id: 'c',
        logged_at: new Date(2026, 3, 6, 0, 0, 0, 1).toISOString(),
      }),
    ]
    const filtered = filterLogsInRange(logs, start, end)
    expect(filtered.map((l) => l.id).sort()).toEqual(['a', 'b'])
  })

  it('returns empty for no matches', () => {
    const start = new Date(2026, 3, 5)
    const end = new Date(2026, 3, 5, 23, 59)
    const logs = [
      makeLog({ logged_at: new Date(2026, 3, 1).toISOString() }),
    ]
    expect(filterLogsInRange(logs, start, end)).toEqual([])
  })

  it('skips logs with invalid logged_at', () => {
    const start = new Date(2026, 3, 5)
    const end = new Date(2026, 3, 5, 23, 59)
    const logs = [makeLog({ logged_at: 'not-a-date' })]
    expect(filterLogsInRange(logs, start, end)).toEqual([])
  })
})

describe('groupLogsByDay', () => {
  it('groups logs by local day, newest day first', () => {
    const logs = [
      makeLog({ id: 'older', logged_at: new Date(2026, 3, 3, 12).toISOString() }),
      makeLog({ id: 'newer', logged_at: new Date(2026, 3, 5, 9).toISOString() }),
      makeLog({ id: 'newer-later', logged_at: new Date(2026, 3, 5, 18).toISOString() }),
    ]
    const grouped = groupLogsByDay(logs)
    const keys = Array.from(grouped.keys())
    expect(keys).toEqual(['2026-04-05', '2026-04-03'])
    // Within a day, newest log first
    expect(grouped.get('2026-04-05')!.map((l) => l.id)).toEqual([
      'newer-later',
      'newer',
    ])
  })

  it('returns empty map for no logs', () => {
    expect(groupLogsByDay([]).size).toBe(0)
  })

  it('skips logs with invalid logged_at instead of producing NaN keys', () => {
    const logs = [
      makeLog({ id: 'bad', logged_at: 'not-a-date' }),
      makeLog({ id: 'good', logged_at: new Date(2026, 3, 5, 9).toISOString() }),
    ]
    const grouped = groupLogsByDay(logs)
    const keys = Array.from(grouped.keys())
    expect(keys).toEqual(['2026-04-05'])
    for (const key of keys) {
      expect(key).not.toContain('NaN')
    }
  })
})

describe('buildDailySeries', () => {
  it('returns N contiguous days ending on endDate', () => {
    const end = new Date(2026, 3, 27)
    const series = buildDailySeries([], 7, end)
    expect(series).toHaveLength(7)
    expect(series[0].date).toBe('2026-04-21')
    expect(series[6].date).toBe('2026-04-27')
    for (const day of series) {
      expect(day.calories).toBe(0)
      expect(day.count).toBe(0)
    }
  })

  it('aggregates logs into the correct day buckets', () => {
    const end = new Date(2026, 3, 27, 12)
    const logs = [
      makeLog({
        total_calories: 500,
        logged_at: new Date(2026, 3, 27, 8).toISOString(),
      }),
      makeLog({
        total_calories: 200,
        logged_at: new Date(2026, 3, 27, 18).toISOString(),
      }),
      makeLog({
        total_calories: 400,
        logged_at: new Date(2026, 3, 25, 10).toISOString(),
      }),
    ]
    const series = buildDailySeries(logs, 7, end)
    const today = series.find((d) => d.date === '2026-04-27')!
    const twoDaysAgo = series.find((d) => d.date === '2026-04-25')!
    expect(today.calories).toBe(700)
    expect(today.count).toBe(2)
    expect(twoDaysAgo.calories).toBe(400)
    expect(twoDaysAgo.count).toBe(1)
  })

  it('returns empty array for non-positive days', () => {
    expect(buildDailySeries([], 0)).toEqual([])
    expect(buildDailySeries([], -1)).toEqual([])
  })

  it('ignores logs outside the window', () => {
    const end = new Date(2026, 3, 27)
    const logs = [
      makeLog({
        total_calories: 9999,
        logged_at: new Date(2026, 2, 1).toISOString(),
      }),
    ]
    const series = buildDailySeries(logs, 7, end)
    const total = series.reduce((sum, d) => sum + d.calories, 0)
    expect(total).toBe(0)
  })
})

describe('getTodayTotals', () => {
  it('only counts logs from today (local)', () => {
    const now = new Date(2026, 3, 27, 14)
    const logs = [
      makeLog({
        total_calories: 500,
        logged_at: new Date(2026, 3, 27, 8).toISOString(),
      }),
      makeLog({
        total_calories: 300,
        logged_at: new Date(2026, 3, 26, 23).toISOString(),
      }),
    ]
    const totals = getTodayTotals(logs, now)
    expect(totals.calories).toBe(500)
  })
})
