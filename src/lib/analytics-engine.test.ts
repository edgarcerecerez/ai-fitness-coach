import { describe, it, expect } from '@jest/globals'
import {
  pearson,
  linearRegression,
  describeCorrelation,
  buildDailyAggregates,
  extractPairs,
  analysePair,
  filterByWindow,
  toDateKey,
} from './analytics-engine'

describe('analytics-engine', () => {
  describe('pearson', () => {
    it('returns null when arrays have fewer than 3 paired values', () => {
      expect(pearson([], [])).toBeNull()
      expect(pearson([1], [2])).toBeNull()
      expect(pearson([1, 2], [2, 4])).toBeNull()
    })

    it('returns null on length mismatch', () => {
      expect(pearson([1, 2, 3], [1, 2])).toBeNull()
    })

    it('returns 1 for a perfectly positive linear relationship', () => {
      const r = pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])
      expect(r).toBeCloseTo(1, 10)
    })

    it('returns -1 for a perfectly negative linear relationship', () => {
      const r = pearson([1, 2, 3, 4, 5], [10, 8, 6, 4, 2])
      expect(r).toBeCloseTo(-1, 10)
    })

    it('returns null when one series has zero variance', () => {
      expect(pearson([1, 1, 1, 1], [1, 2, 3, 4])).toBeNull()
      expect(pearson([1, 2, 3, 4], [5, 5, 5, 5])).toBeNull()
    })

    it('produces a moderate value for noisy data', () => {
      const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const ys = [2, 1, 4, 3, 6, 5, 8, 7, 10, 9]
      const r = pearson(xs, ys)
      expect(r).not.toBeNull()
      expect(r!).toBeGreaterThan(0.9)
    })
  })

  describe('linearRegression', () => {
    it('fits y = 2x + 1', () => {
      const trend = linearRegression([0, 1, 2, 3, 4], [1, 3, 5, 7, 9])
      expect(trend).not.toBeNull()
      expect(trend!.slope).toBeCloseTo(2, 10)
      expect(trend!.intercept).toBeCloseTo(1, 10)
    })

    it('returns null when x has zero variance', () => {
      expect(linearRegression([1, 1, 1], [1, 2, 3])).toBeNull()
    })

    it('returns null with too few points', () => {
      expect(linearRegression([1], [2])).toBeNull()
    })
  })

  describe('describeCorrelation', () => {
    it('labels insufficient data when r is null', () => {
      expect(describeCorrelation(null, 0)).toEqual({
        r: null,
        n: 0,
        strength: 'insufficient_data',
        direction: 'none',
      })
    })

    it('labels insufficient data when n < 3 even if r is provided', () => {
      const result = describeCorrelation(0.9, 2)
      expect(result.strength).toBe('insufficient_data')
      expect(result.r).toBeNull()
    })

    it('classifies strength buckets', () => {
      expect(describeCorrelation(0.85, 10).strength).toBe('strong')
      expect(describeCorrelation(0.5, 10).strength).toBe('moderate')
      expect(describeCorrelation(0.25, 10).strength).toBe('weak')
      expect(describeCorrelation(0.1, 10).strength).toBe('none')
      expect(describeCorrelation(-0.85, 10).strength).toBe('strong')
    })

    it('reports direction', () => {
      expect(describeCorrelation(0.85, 10).direction).toBe('positive')
      expect(describeCorrelation(-0.5, 10).direction).toBe('negative')
      expect(describeCorrelation(0.1, 10).direction).toBe('none')
    })
  })

  describe('toDateKey', () => {
    it('returns YYYY-MM-DD in UTC', () => {
      expect(toDateKey('2026-01-15T23:30:00Z')).toBe('2026-01-15')
    })

    it('returns empty string for invalid input', () => {
      expect(toDateKey('not a date')).toBe('')
    })
  })

  describe('buildDailyAggregates', () => {
    it('aggregates per-day weight (avg), calories (sum), mood (avg)', () => {
      const result = buildDailyAggregates(
        [
          { recorded_at: '2026-01-01T08:00:00Z', weight_kg: 80 },
          { recorded_at: '2026-01-01T20:00:00Z', weight_kg: 82 },
          { recorded_at: '2026-01-02T08:00:00Z', weight_kg: 81 },
        ],
        [
          { recorded_at: '2026-01-01T12:00:00Z', total_calories: 600 },
          { recorded_at: '2026-01-01T19:00:00Z', total_calories: 800 },
          { recorded_at: '2026-01-02T12:00:00Z', total_calories: 1500 },
        ],
        [
          { recorded_at: '2026-01-01T22:00:00Z', mood_score: 7 },
          { recorded_at: '2026-01-02T22:00:00Z', mood_score: 5 },
          { recorded_at: '2026-01-02T08:00:00Z', mood_score: 9 },
        ]
      )

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        date: '2026-01-01',
        weight_kg: 81,
        calories: 1400,
        mood_score: 7,
      })
      expect(result[1]).toEqual({
        date: '2026-01-02',
        weight_kg: 81,
        calories: 1500,
        mood_score: 7,
      })
    })

    it('parses numeric strings (e.g. Supabase decimal columns)', () => {
      const result = buildDailyAggregates(
        [{ recorded_at: '2026-01-01T08:00:00Z', weight_kg: '80.5' }],
        [{ recorded_at: '2026-01-01T12:00:00Z', total_calories: '600' }],
        [{ recorded_at: '2026-01-01T22:00:00Z', mood_score: '7' }]
      )
      expect(result[0].weight_kg).toBe(80.5)
      expect(result[0].calories).toBe(600)
      expect(result[0].mood_score).toBe(7)
    })

    it('skips invalid timestamps and null values', () => {
      const result = buildDailyAggregates(
        [
          { recorded_at: 'invalid', weight_kg: 80 },
          { recorded_at: '2026-01-01T08:00:00Z', weight_kg: null },
        ],
        [],
        []
      )
      expect(result).toHaveLength(0)
    })

    it('sorts results by date ascending', () => {
      const result = buildDailyAggregates(
        [
          { recorded_at: '2026-01-03T08:00:00Z', weight_kg: 80 },
          { recorded_at: '2026-01-01T08:00:00Z', weight_kg: 82 },
          { recorded_at: '2026-01-02T08:00:00Z', weight_kg: 81 },
        ],
        [],
        []
      )
      expect(result.map((r) => r.date)).toEqual([
        '2026-01-01',
        '2026-01-02',
        '2026-01-03',
      ])
    })
  })

  describe('extractPairs / analysePair', () => {
    it('drops days where either side is null', () => {
      const aggregates = [
        { date: '2026-01-01', weight_kg: 80, calories: 2000, mood_score: 7 },
        { date: '2026-01-02', weight_kg: 81, calories: null, mood_score: 6 },
        { date: '2026-01-03', weight_kg: null, calories: 1800, mood_score: 7 },
        { date: '2026-01-04', weight_kg: 79, calories: 1500, mood_score: 8 },
      ]
      const { xs, ys, points } = extractPairs(aggregates, 'weight_kg', 'calories')
      expect(xs).toEqual([80, 79])
      expect(ys).toEqual([2000, 1500])
      expect(points).toHaveLength(2)
      expect(points[0].date).toBe('2026-01-01')
    })

    it('analysePair returns insufficient data when fewer than 3 paired days', () => {
      const aggregates = [
        { date: '2026-01-01', weight_kg: 80, calories: 2000, mood_score: 7 },
        { date: '2026-01-02', weight_kg: 81, calories: 2100, mood_score: 6 },
      ]
      const result = analysePair(aggregates, 'weight_kg', 'calories')
      expect(result.correlation.strength).toBe('insufficient_data')
      expect(result.correlation.r).toBeNull()
    })

    it('analysePair computes correlation and trend on valid data', () => {
      const aggregates = Array.from({ length: 10 }, (_, i) => ({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        weight_kg: 80 + i,
        calories: 2000 + i * 100,
        mood_score: 7,
      }))
      const result = analysePair(aggregates, 'weight_kg', 'calories')
      expect(result.correlation.r).toBeCloseTo(1, 10)
      expect(result.correlation.strength).toBe('strong')
      expect(result.trend).not.toBeNull()
      expect(result.trend!.slope).toBeCloseTo(100, 10)
    })
  })

  describe('filterByWindow', () => {
    it('keeps only the last N days inclusive', () => {
      const aggregates = [
        { date: '2026-01-01', weight_kg: 80, calories: null, mood_score: null },
        { date: '2026-01-05', weight_kg: 81, calories: null, mood_score: null },
        { date: '2026-01-10', weight_kg: 82, calories: null, mood_score: null },
      ]
      const now = new Date('2026-01-10T12:00:00Z')
      const filtered = filterByWindow(aggregates, 6, now)
      expect(filtered.map((a) => a.date)).toEqual(['2026-01-05', '2026-01-10'])
    })

    it('returns all aggregates when window is non-positive', () => {
      const aggregates = [
        { date: '2026-01-01', weight_kg: 80, calories: null, mood_score: null },
      ]
      expect(filterByWindow(aggregates, 0)).toEqual(aggregates)
      expect(filterByWindow(aggregates, -5)).toEqual(aggregates)
    })
  })
})
