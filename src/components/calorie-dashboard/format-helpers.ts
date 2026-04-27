import { NutritionLog } from '@/lib/nutrition-types'
import { startOfLocalDay, toLocalDateKey } from '@/lib/calorie-aggregations'

/** Coerce a possibly-null/undefined macro value to a finite number (or 0). */
export function macro(value: number | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Friendly display name for a meal — uses the first food item's name. */
export function logDisplayName(log: NutritionLog): string {
  const items = log.food_items ?? []
  const names = items
    .map((item) => item.name?.trim())
    .filter((n): n is string => Boolean(n))
  if (names.length === 0) return 'Meal'
  if (names.length === 1) return names[0]
  return `${names[0]} +${names.length - 1} more`
}

/** Today / Yesterday / "Mon, Apr 5" — accepts a local-day key. */
export function formatDayHeading(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  const date = new Date(year, month - 1, day)
  const today = startOfLocalDay(new Date())
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (toLocalDateKey(date) === toLocalDateKey(today)) return 'Today'
  if (toLocalDateKey(date) === toLocalDateKey(yesterday)) return 'Yesterday'
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

/** "9:42 AM" or "" for an invalid timestamp. */
export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** "Apr 5, 2026, 9:42 AM" or the raw input on parse failure. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Locale-aware number formatter with fixed fraction digits. */
export function formatNumber(n: number, fractionDigits = 0): string {
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}
