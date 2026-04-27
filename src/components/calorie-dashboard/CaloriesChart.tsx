'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { DailyTotals } from '@/lib/calorie-aggregations'

interface CaloriesChartProps {
  data: DailyTotals[]
}

function formatDayLabel(isoDate: string): string {
  // ISO date keys are local-time `YYYY-MM-DD`; parse explicitly to avoid the
  // UTC interpretation that `new Date('YYYY-MM-DD')` triggers.
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
}

export default function CaloriesChart({ data }: CaloriesChartProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        date: d.date,
        label: formatDayLabel(d.date),
        calories: Math.round(d.calories),
      })),
    [data]
  )

  // Use the raw, unrounded values so tiny positive totals (e.g. 0.4 kcal) do
  // not collapse to 0 and trigger the empty state.
  const hasAny = data.some((d) => d.calories > 0)

  if (!hasAny) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No calorie data in the last 7 days yet.
      </div>
    )
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            allowDecimals={false}
            width={48}
          />
          <Tooltip
            cursor={{ fillOpacity: 0.1 }}
            formatter={(value: number) => [`${value} kcal`, 'Calories']}
            labelFormatter={(label) => `${label}`}
          />
          <Bar
            dataKey="calories"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
