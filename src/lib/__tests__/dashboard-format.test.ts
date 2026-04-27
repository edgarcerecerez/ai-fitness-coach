import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals'
import {
  buildDailySeries,
  formatLatestMood,
  formatLatestWeight,
  formatTodayCalories,
} from '../dashboard-format'

const FIXED_NOW = new Date('2026-04-27T12:00:00.000Z').getTime()

beforeAll(() => {
  jest.useFakeTimers().setSystemTime(FIXED_NOW)
})

afterAll(() => {
  jest.useRealTimers()
})

describe('buildDailySeries', () => {
  it('returns a contiguous 7-day series ending today', () => {
    const series = buildDailySeries([], 7, 'sum', 0)
    expect(series).toHaveLength(7)
    expect(series[6].date).toBe('2026-04-27')
    expect(series[0].date).toBe('2026-04-21')
  })

  it('sums entries that share the same UTC day', () => {
    const series = buildDailySeries(
      [
        { value: 100, recorded_at: '2026-04-27T08:00:00Z' },
        { value: 250, recorded_at: '2026-04-27T20:00:00Z' },
      ],
      7,
      'sum',
      0
    )
    expect(series[6].value).toBe(350)
  })

  it('keeps only the latest value per day when reducer=latest', () => {
    const series = buildDailySeries(
      [
        { value: 80, recorded_at: '2026-04-27T08:00:00Z' },
        { value: 79.5, recorded_at: '2026-04-27T20:00:00Z' },
      ],
      7,
      'latest',
      null
    )
    expect(series[6].value).toBe(79.5)
  })
})

describe('formatLatestWeight', () => {
  it('returns an empty state when there are no rows', () => {
    const result = formatLatestWeight([], 'kg')
    expect(result.hasData).toBe(false)
    expect(result.display).toBe('No data yet')
    expect(result.series).toHaveLength(7)
  })

  it('formats the most recent weight in the requested unit', () => {
    const result = formatLatestWeight(
      [
        { weight_kg: 80, recorded_at: '2026-04-25T08:00:00Z' },
        { weight_kg: 79.5, recorded_at: '2026-04-27T08:00:00Z' },
      ],
      'kg'
    )
    expect(result.hasData).toBe(true)
    expect(result.display).toContain('79.5')
  })
})

describe('formatTodayCalories', () => {
  it('sums only today’s entries', () => {
    const result = formatTodayCalories([
      { total_calories: 500, recorded_at: '2026-04-27T08:00:00Z' },
      { total_calories: 700, recorded_at: '2026-04-27T18:00:00Z' },
      { total_calories: 999, recorded_at: '2026-04-26T18:00:00Z' },
    ])
    expect(result.hasData).toBe(true)
    expect(result.display).toBe('1,200 kcal')
  })

  it('shows the empty state when there are no meals today', () => {
    const result = formatTodayCalories([
      { total_calories: 800, recorded_at: '2026-04-26T08:00:00Z' },
    ])
    expect(result.hasData).toBe(false)
    expect(result.display).toBe('No meals today')
  })
})

describe('formatLatestMood', () => {
  it('returns the latest mood score', () => {
    const result = formatLatestMood([
      { mood_score: 6, recorded_at: '2026-04-25T08:00:00Z' },
      { mood_score: 8, recorded_at: '2026-04-27T08:00:00Z' },
    ])
    expect(result.hasData).toBe(true)
    expect(result.display).toBe('8/10')
  })

  it('handles the empty case', () => {
    const result = formatLatestMood([])
    expect(result.hasData).toBe(false)
    expect(result.display).toBe('No mood logged')
  })
})
