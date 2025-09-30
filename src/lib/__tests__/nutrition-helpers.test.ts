import {
  getConfidenceLevel,
  getConfidenceColor,
  getConfidenceBadgeVariant,
  getConfidenceText,
  formatCalories,
  calculateDailyTotal,
  formatConfidencePercentage,
} from '../nutrition-helpers'

describe('nutrition-helpers', () => {
  describe('getConfidenceLevel', () => {
    it('returns high for scores >= 0.8', () => {
      expect(getConfidenceLevel(0.8)).toBe('high')
      expect(getConfidenceLevel(0.9)).toBe('high')
      expect(getConfidenceLevel(1.0)).toBe('high')
    })

    it('returns medium for scores >= 0.6 and < 0.8', () => {
      expect(getConfidenceLevel(0.6)).toBe('medium')
      expect(getConfidenceLevel(0.7)).toBe('medium')
      expect(getConfidenceLevel(0.79)).toBe('medium')
    })

    it('returns low for scores < 0.6', () => {
      expect(getConfidenceLevel(0.0)).toBe('low')
      expect(getConfidenceLevel(0.5)).toBe('low')
      expect(getConfidenceLevel(0.59)).toBe('low')
    })
  })

  describe('getConfidenceColor', () => {
    it('returns correct theme color for each level', () => {
      expect(getConfidenceColor(0.9)).toBe('text-chart-1')
      expect(getConfidenceColor(0.7)).toBe('text-chart-4')
      expect(getConfidenceColor(0.5)).toBe('text-destructive')
    })
  })

  describe('getConfidenceBadgeVariant', () => {
    it('returns correct badge variant for each level', () => {
      expect(getConfidenceBadgeVariant(0.9)).toBe('success')
      expect(getConfidenceBadgeVariant(0.7)).toBe('warning')
      expect(getConfidenceBadgeVariant(0.5)).toBe('destructive')
    })
  })

  describe('formatCalories', () => {
    it('formats calorie values correctly', () => {
      expect(formatCalories(450)).toBe('450 cal')
      expect(formatCalories(1234.5)).toBe('1235 cal')
    })

    it('handles null and undefined', () => {
      expect(formatCalories(null)).toBe('0 cal')
      expect(formatCalories(undefined)).toBe('0 cal')
    })
  })

  describe('calculateDailyTotal', () => {
    it('sums only today\'s logs', () => {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const logs = [
        { total_calories: 400, created_at: today.toISOString() },
        { total_calories: 600, created_at: today.toISOString() },
        { total_calories: 300, created_at: yesterday.toISOString() },
      ]

      expect(calculateDailyTotal(logs)).toBe(1000)
    })

    it('handles null calories', () => {
      const today = new Date()
      const logs = [
        { total_calories: 400, created_at: today.toISOString() },
        { total_calories: null, created_at: today.toISOString() },
      ]

      expect(calculateDailyTotal(logs)).toBe(400)
    })
  })

  describe('formatConfidencePercentage', () => {
    it('formats confidence as percentage', () => {
      expect(formatConfidencePercentage(0.85)).toBe('85%')
      expect(formatConfidencePercentage(0.5)).toBe('50%')
      expect(formatConfidencePercentage(1.0)).toBe('100%')
    })
  })
})