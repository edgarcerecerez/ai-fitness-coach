/**
 * Helpers for shaping raw Supabase rows into the values rendered by the
 * unified `/dashboard` page. Kept pure and side-effect-free so the server
 * page can stay thin and the helpers can be unit-tested in isolation.
 */

import {
  type WeightUnit,
  convertFromKg,
  formatWeightWithConfig,
} from "./weight-conversion"

export interface SeriesPoint {
  /** ISO date (YYYY-MM-DD) for the bucket. */
  date: string
  value: number
}

export interface WeightLogRow {
  weight_kg: number | null
  recorded_at: string | null
}

export interface NutritionLogRow {
  total_calories: number | null
  recorded_at: string | null
}

export interface MoodLogRow {
  mood_score: number | null
  recorded_at: string | null
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Returns YYYY-MM-DD for a Date, in UTC. */
function toIsoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Builds a contiguous `days`-length series ending today (UTC), filling any
 * day without data using `fill`. The most recent value per day is used when
 * multiple rows share the same date.
 */
export function buildDailySeries(
  rows: ReadonlyArray<{ value: number | null; recorded_at: string | null }>,
  days: number,
  reducer: "latest" | "sum",
  fill: number | null = null
): SeriesPoint[] {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const buckets = new Map<string, { value: number; ts: number }>()
  for (const row of rows) {
    if (row.value === null || row.value === undefined) continue
    if (!row.recorded_at) continue
    const ts = new Date(row.recorded_at).getTime()
    if (Number.isNaN(ts)) continue
    const key = toIsoDay(new Date(ts))
    const existing = buckets.get(key)
    if (!existing) {
      buckets.set(key, { value: row.value, ts })
    } else if (reducer === "sum") {
      existing.value += row.value
    } else if (ts > existing.ts) {
      existing.value = row.value
      existing.ts = ts
    }
  }

  const series: SeriesPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today.getTime() - i * MS_PER_DAY)
    const key = toIsoDay(day)
    const bucket = buckets.get(key)
    series.push({
      date: key,
      value: bucket ? bucket.value : (fill ?? 0),
    })
  }
  return series
}

/**
 * Returns the row with the most recent `recorded_at`, ignoring rows whose
 * tracked value or timestamp is null.
 */
function pickLatest<T extends { recorded_at: string | null }>(
  rows: ReadonlyArray<T>,
  valueKey: keyof T
): (T & { recorded_at: string }) | undefined {
  let latest: (T & { recorded_at: string }) | undefined
  let latestTs = -Infinity
  for (const row of rows) {
    if (row[valueKey] === null || row[valueKey] === undefined) continue
    if (!row.recorded_at) continue
    const ts = new Date(row.recorded_at).getTime()
    if (!Number.isNaN(ts) && ts > latestTs) {
      latestTs = ts
      latest = row as T & { recorded_at: string }
    }
  }
  return latest
}

export interface LatestWeight {
  display: string
  hasData: boolean
  series: SeriesPoint[]
}

export function formatLatestWeight(
  rows: ReadonlyArray<WeightLogRow>,
  unit: WeightUnit
): LatestWeight {
  const latest = pickLatest(rows, "weight_kg")
  const display = latest?.weight_kg != null
    ? formatWeightWithConfig(latest.weight_kg, {
        unit,
        precision: 1,
        showUnit: true,
      })
    : "No data yet"
  const series = buildDailySeries(
    rows
      .filter((r): r is WeightLogRow & { weight_kg: number } => r.weight_kg !== null)
      .map((r) => ({
        value: convertFromKg(r.weight_kg, unit),
        recorded_at: r.recorded_at,
      })),
    7,
    "latest",
    null
  )
  return { display, hasData: Boolean(latest), series }
}

export interface LatestCalories {
  display: string
  hasData: boolean
  series: SeriesPoint[]
}

export function formatTodayCalories(
  rows: ReadonlyArray<NutritionLogRow>
): LatestCalories {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayKey = toIsoDay(today)

  let totalToday = 0
  let hasToday = false
  for (const row of rows) {
    if (row.total_calories === null || !row.recorded_at) continue
    if (toIsoDay(new Date(row.recorded_at)) === todayKey) {
      totalToday += row.total_calories
      hasToday = true
    }
  }

  const series = buildDailySeries(
    rows.map((r) => ({
      value: r.total_calories,
      recorded_at: r.recorded_at,
    })),
    7,
    "sum",
    0
  )

  return {
    display: hasToday ? `${totalToday.toLocaleString()} kcal` : "No meals today",
    hasData: hasToday,
    series,
  }
}

export interface LatestMood {
  display: string
  hasData: boolean
  series: SeriesPoint[]
}

export function formatLatestMood(rows: ReadonlyArray<MoodLogRow>): LatestMood {
  const latest = pickLatest(rows, "mood_score")
  const series = buildDailySeries(
    rows.map((r) => ({ value: r.mood_score, recorded_at: r.recorded_at })),
    7,
    "latest",
    null
  )
  return {
    display: latest ? `${latest.mood_score}/10` : "No mood logged",
    hasData: Boolean(latest),
    series,
  }
}
