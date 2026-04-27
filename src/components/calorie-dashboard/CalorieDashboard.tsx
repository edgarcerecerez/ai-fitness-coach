'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { NutritionLog } from '@/lib/nutrition-types'
import {
  buildDailySeries,
  endOfLocalDay,
  filterLogsInRange,
  startOfLocalDay,
  sumNutritionLogs,
} from '@/lib/calorie-aggregations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import SummaryStats from './SummaryStats'
import CaloriesChart from './CaloriesChart'
import MealHistory from './MealHistory'

type RangeKey = 'today' | 'this-week' | 'last-7-days'

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'this-week', label: 'This Week' },
  { key: 'last-7-days', label: 'Last 7 Days' },
]

interface CalorieDashboardProps {
  initialLogs: NutritionLog[]
}

/**
 * Compute the inclusive [start, end] window for a given range key relative to
 * the current local time. "This Week" starts on Monday — the same convention
 * used for the weekly chart x-axis.
 */
function rangeBounds(range: RangeKey, now: Date = new Date()): {
  start: Date
  end: Date
} {
  const end = endOfLocalDay(now)
  if (range === 'today') {
    return { start: startOfLocalDay(now), end }
  }
  if (range === 'this-week') {
    const start = startOfLocalDay(now)
    // JS getDay(): Sunday = 0 ... Saturday = 6. Treat Monday as start of week.
    const dayOfWeek = start.getDay()
    const offsetToMonday = (dayOfWeek + 6) % 7
    start.setDate(start.getDate() - offsetToMonday)
    return { start, end }
  }
  // last-7-days
  const start = startOfLocalDay(now)
  start.setDate(start.getDate() - 6)
  return { start, end }
}

export default function CalorieDashboard({
  initialLogs,
}: CalorieDashboardProps) {
  const router = useRouter()
  const [range, setRange] = useState<RangeKey>('today')
  const [logs, setLogs] = useState<NutritionLog[]>(initialLogs)

  // Re-sync local state when the server prop changes (e.g. after
  // `router.refresh()` returns updated server-rendered logs).
  useEffect(() => {
    setLogs(initialLogs)
  }, [initialLogs])

  const totals = useMemo(() => {
    const { start, end } = rangeBounds(range)
    return sumNutritionLogs(filterLogsInRange(logs, start, end))
  }, [logs, range])

  // The weekly chart always shows the trailing 7 days regardless of the
  // summary range so trends remain visible even when the user is focused on
  // today's totals.
  const weeklySeries = useMemo(() => buildDailySeries(logs, 7), [logs])

  const summaryLabel =
    range === 'today'
      ? "Today's Totals"
      : range === 'this-week'
        ? 'This Week (Mon-Today)'
        : 'Last 7 Days'

  const handleLogChanged = (updated: NutritionLog) => {
    setLogs((prev) => prev.map((log) => (log.id === updated.id ? updated : log)))
    router.refresh()
  }

  const handleLogDeleted = (id: string) => {
    setLogs((prev) => prev.filter((log) => log.id !== id))
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((opt) => (
          <Button
            key={opt.key}
            variant={range === opt.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRange(opt.key)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <SummaryStats label={summaryLabel} totals={totals} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">7-Day Calorie Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <CaloriesChart data={weeklySeries} />
        </CardContent>
      </Card>

      <MealHistory
        logs={logs}
        onLogChanged={handleLogChanged}
        onLogDeleted={handleLogDeleted}
      />
    </div>
  )
}
