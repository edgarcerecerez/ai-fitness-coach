/**
 * Analytics engine - pure computation helpers for correlation analysis
 * across weight, nutrition, and mood logs.
 *
 * These helpers are intentionally side-effect free so they can be unit
 * tested in isolation and reused on either the server or client.
 */

export interface WeightLog {
  recorded_at: string
  weight_kg: number | string | null
}

export interface NutritionLog {
  recorded_at: string
  total_calories: number | string | null
}

export interface MoodLog {
  recorded_at: string
  mood_score: number | string | null
}

export interface DailyAggregate {
  date: string // YYYY-MM-DD
  weight_kg: number | null
  calories: number | null
  mood_score: number | null
}

export interface CorrelationResult {
  // Pearson correlation coefficient in [-1, 1], or null if undefined
  r: number | null
  // Number of paired observations used
  n: number
  // Plain-language strength label
  strength: 'insufficient_data' | 'none' | 'weak' | 'moderate' | 'strong'
  // Direction of the relationship
  direction: 'positive' | 'negative' | 'none'
}

export interface ScatterPoint {
  x: number
  y: number
  date: string
}

export interface TrendLine {
  slope: number
  intercept: number
}

/**
 * Returns YYYY-MM-DD for the given ISO timestamp using UTC.
 * Using UTC keeps the bucketing deterministic regardless of server timezone.
 */
export function toDateKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return ''
  }
  return d.toISOString().slice(0, 10)
}

function toNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'string' ? parseFloat(v) : v
  return Number.isFinite(n) ? n : null
}

/**
 * Aggregates raw logs into one record per calendar day (UTC). Within a day:
 * - weight_kg is averaged (in case multiple weigh-ins occur)
 * - calories are summed (daily total intake)
 * - mood_score is averaged
 */
export function buildDailyAggregates(
  weights: WeightLog[],
  nutrition: NutritionLog[],
  moods: MoodLog[]
): DailyAggregate[] {
  const map = new Map<
    string,
    {
      wSum: number
      wCount: number
      cSum: number
      cCount: number
      mSum: number
      mCount: number
    }
  >()

  const ensure = (key: string) => {
    let entry = map.get(key)
    if (!entry) {
      entry = { wSum: 0, wCount: 0, cSum: 0, cCount: 0, mSum: 0, mCount: 0 }
      map.set(key, entry)
    }
    return entry
  }

  for (const w of weights) {
    const key = toDateKey(w.recorded_at)
    const val = toNumber(w.weight_kg)
    if (!key || val === null) continue
    const entry = ensure(key)
    entry.wSum += val
    entry.wCount += 1
  }

  for (const n of nutrition) {
    const key = toDateKey(n.recorded_at)
    const val = toNumber(n.total_calories)
    if (!key || val === null) continue
    const entry = ensure(key)
    entry.cSum += val
    entry.cCount += 1
  }

  for (const m of moods) {
    const key = toDateKey(m.recorded_at)
    const val = toNumber(m.mood_score)
    if (!key || val === null) continue
    const entry = ensure(key)
    entry.mSum += val
    entry.mCount += 1
  }

  const out: DailyAggregate[] = []
  for (const [date, entry] of map.entries()) {
    out.push({
      date,
      weight_kg: entry.wCount > 0 ? entry.wSum / entry.wCount : null,
      // Use entry count rather than `cSum > 0` so legitimate zero-calorie
      // days (e.g. fasting) are preserved instead of being dropped.
      calories: entry.cCount > 0 ? entry.cSum : null,
      mood_score: entry.mCount > 0 ? entry.mSum / entry.mCount : null,
    })
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return out
}

/**
 * Pearson correlation coefficient between two numeric arrays.
 * Returns null when n < 3 or when either series has zero variance.
 */
export function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length) return null
  const n = xs.length
  if (n < 3) return null

  let sumX = 0
  let sumY = 0
  for (let i = 0; i < n; i++) {
    sumX += xs[i]
    sumY += ys[i]
  }
  const meanX = sumX / n
  const meanY = sumY / n

  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }

  if (denX === 0 || denY === 0) return null
  return num / Math.sqrt(denX * denY)
}

/**
 * Linear regression (least squares) producing slope + intercept usable for
 * a y = slope * x + intercept trend line.
 * Returns null when n < 2 or x has zero variance.
 */
export function linearRegression(xs: number[], ys: number[]): TrendLine | null {
  if (xs.length !== ys.length) return null
  const n = xs.length
  if (n < 2) return null

  let sumX = 0
  let sumY = 0
  for (let i = 0; i < n; i++) {
    sumX += xs[i]
    sumY += ys[i]
  }
  const meanX = sumX / n
  const meanY = sumY / n

  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    num += dx * (ys[i] - meanY)
    den += dx * dx
  }
  if (den === 0) return null
  const slope = num / den
  const intercept = meanY - slope * meanX
  return { slope, intercept }
}

/**
 * Maps a Pearson r to a qualitative strength label.
 */
export function describeCorrelation(r: number | null, n: number): CorrelationResult {
  if (r === null || n < 3) {
    return { r: null, n, strength: 'insufficient_data', direction: 'none' }
  }
  const abs = Math.abs(r)
  let strength: CorrelationResult['strength'] = 'none'
  if (abs >= 0.7) strength = 'strong'
  else if (abs >= 0.4) strength = 'moderate'
  else if (abs >= 0.2) strength = 'weak'
  else strength = 'none'

  const direction: CorrelationResult['direction'] =
    strength === 'none' ? 'none' : r > 0 ? 'positive' : 'negative'

  return { r, n, strength, direction }
}

/**
 * Extracts paired (x, y) observations from daily aggregates, dropping any day
 * where either field is null. Returns the aligned arrays plus scatter-friendly
 * points carrying the date for tooltips.
 */
export function extractPairs(
  aggregates: DailyAggregate[],
  xKey: keyof Pick<DailyAggregate, 'weight_kg' | 'calories' | 'mood_score'>,
  yKey: keyof Pick<DailyAggregate, 'weight_kg' | 'calories' | 'mood_score'>
): { xs: number[]; ys: number[]; points: ScatterPoint[] } {
  const xs: number[] = []
  const ys: number[] = []
  const points: ScatterPoint[] = []
  for (const a of aggregates) {
    const x = a[xKey]
    const y = a[yKey]
    if (x === null || y === null) continue
    xs.push(x)
    ys.push(y)
    points.push({ x, y, date: a.date })
  }
  return { xs, ys, points }
}

/**
 * Convenience: compute correlation + trend for one (x, y) pair.
 */
export function analysePair(
  aggregates: DailyAggregate[],
  xKey: keyof Pick<DailyAggregate, 'weight_kg' | 'calories' | 'mood_score'>,
  yKey: keyof Pick<DailyAggregate, 'weight_kg' | 'calories' | 'mood_score'>
): {
  correlation: CorrelationResult
  trend: TrendLine | null
  points: ScatterPoint[]
} {
  const { xs, ys, points } = extractPairs(aggregates, xKey, yKey)
  const r = pearson(xs, ys)
  const correlation = describeCorrelation(r, xs.length)
  const trend = linearRegression(xs, ys)
  return { correlation, trend, points }
}

/**
 * Filters aggregates to the last `days` days from `now` (inclusive of today).
 */
export function filterByWindow(
  aggregates: DailyAggregate[],
  days: number,
  now: Date = new Date()
): DailyAggregate[] {
  if (!Number.isFinite(days) || days <= 0) return aggregates
  const cutoff = new Date(now)
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1))
  const cutoffKey = cutoff.toISOString().slice(0, 10)
  // Exclude future-dated aggregates (e.g. clock skew or bad data) so the
  // window never extends past today.
  const nowKey = now.toISOString().slice(0, 10)
  return aggregates.filter((a) => a.date >= cutoffKey && a.date <= nowKey)
}
