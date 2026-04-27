import { NutritionLog } from './nutrition-types'

export interface NutritionTotals {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
}

export interface DailyTotals extends NutritionTotals {
  /** ISO date string in `YYYY-MM-DD` format (local time). */
  date: string
  count: number
}

export const EMPTY_TOTALS: NutritionTotals = {
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
}

/**
 * Format a Date as `YYYY-MM-DD` using its local-time fields.
 *
 * The dashboard groups entries by the user's local day, so we deliberately
 * avoid `toISOString()` which would shift entries near midnight to the wrong
 * day in non-UTC timezones.
 */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Returns midnight (local time) for the day of the supplied date.
 */
export function startOfLocalDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/**
 * Returns the end of the supplied date in local time (23:59:59.999).
 */
export function endOfLocalDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy
}

/**
 * Sum totals across an arbitrary list of nutrition logs.
 *
 * Coerces missing/null macronutrient fields to 0 so partial logs (for
 * example, calories-only manual entries) never produce `NaN` totals.
 */
export function sumNutritionLogs(logs: NutritionLog[]): NutritionTotals {
  return logs.reduce<NutritionTotals>(
    (totals, log) => ({
      calories: totals.calories + (Number(log.total_calories) || 0),
      protein_g: totals.protein_g + (Number(log.total_protein_g) || 0),
      carbs_g: totals.carbs_g + (Number(log.total_carbs_g) || 0),
      fat_g: totals.fat_g + (Number(log.total_fat_g) || 0),
      fiber_g: totals.fiber_g + (Number(log.total_fiber_g) || 0),
    }),
    { ...EMPTY_TOTALS }
  )
}

/**
 * Filter nutrition logs whose `logged_at` falls inside the inclusive range.
 */
export function filterLogsInRange(
  logs: NutritionLog[],
  start: Date,
  end: Date
): NutritionLog[] {
  const startMs = start.getTime()
  const endMs = end.getTime()
  return logs.filter((log) => {
    const ts = new Date(log.logged_at).getTime()
    return !Number.isNaN(ts) && ts >= startMs && ts <= endMs
  })
}

/**
 * Bucket logs by local-day key. Insertion order matches input order.
 */
function bucketLogsByDay(logs: NutritionLog[]): Map<string, NutritionLog[]> {
  const buckets = new Map<string, NutritionLog[]>()
  for (const log of logs) {
    const key = toLocalDateKey(new Date(log.logged_at))
    const bucket = buckets.get(key)
    if (bucket) bucket.push(log)
    else buckets.set(key, [log])
  }
  return buckets
}

/**
 * Group nutrition logs by the local-time day of `logged_at`. Days are
 * returned newest-first; entries within each day are also newest-first.
 */
export function groupLogsByDay(
  logs: NutritionLog[]
): Map<string, NutritionLog[]> {
  const buckets = bucketLogsByDay(logs)
  for (const bucket of buckets.values()) {
    bucket.sort(
      (a, b) =>
        new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
    )
  }
  return new Map(
    Array.from(buckets.entries()).sort(([a], [b]) => (a < b ? 1 : -1))
  )
}

/**
 * Build a contiguous N-day series ending on `endDate` (local time), filling
 * missing days with zero totals so charts render without gaps.
 */
export function buildDailySeries(
  logs: NutritionLog[],
  days: number,
  endDate: Date = new Date()
): DailyTotals[] {
  if (days <= 0) return []

  const end = startOfLocalDay(endDate)
  const buckets = bucketLogsByDay(logs)
  const series: DailyTotals[] = []

  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date(end)
    day.setDate(end.getDate() - offset)
    const key = toLocalDateKey(day)
    const dayLogs = buckets.get(key) ?? []
    series.push({
      date: key,
      count: dayLogs.length,
      ...sumNutritionLogs(dayLogs),
    })
  }

  return series
}

/**
 * Convenience helper that returns just the totals for "today" in local time.
 */
export function getTodayTotals(
  logs: NutritionLog[],
  now: Date = new Date()
): NutritionTotals {
  const start = startOfLocalDay(now)
  const end = endOfLocalDay(now)
  return sumNutritionLogs(filterLogsInRange(logs, start, end))
}
