export type ConfidenceLevel = 'high' | 'medium' | 'low'

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.8) return 'high'
  if (score >= 0.6) return 'medium'
  return 'low'
}

export function getConfidenceColor(score: number): string {
  const level = getConfidenceLevel(score)
  switch (level) {
    case 'high': return 'text-chart-1' // Green in theme
    case 'medium': return 'text-chart-4' // Yellow in theme
    case 'low': return 'text-destructive' // Red in theme
  }
}

export function getConfidenceBadgeVariant(
  score: number
): 'success' | 'warning' | 'destructive' {
  const level = getConfidenceLevel(score)
  switch (level) {
    case 'high': return 'success'
    case 'medium': return 'warning'
    case 'low': return 'destructive'
  }
}

export function getConfidenceText(score: number): string {
  const level = getConfidenceLevel(score)
  switch (level) {
    case 'high': return 'High Confidence'
    case 'medium': return 'Medium Confidence'
    case 'low': return 'Low Confidence'
  }
}

export function formatCalories(calories: number | null | undefined): string {
  if (calories === null || calories === undefined) return '0 cal'
  return `${Math.round(calories)} cal`
}

export function calculateDailyTotal(
  logs: Array<{ total_calories: number | null; created_at: string }>
): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return logs.reduce((total, log) => {
    const logDate = new Date(log.created_at)
    logDate.setHours(0, 0, 0, 0)

    if (logDate.getTime() === today.getTime()) {
      return total + (log.total_calories ?? 0)
    }
    return total
  }, 0)
}

export function formatConfidencePercentage(score: number): string {
  return `${Math.round(score * 100)}%`
}