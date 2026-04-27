"use client"

import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts"
import type { SeriesPoint } from "@/lib/dashboard-format"

interface SparklineProps {
  data: ReadonlyArray<SeriesPoint>
  /** Stroke + fill base color (defaults to a tailwind blue). */
  color?: string
  /** Accessible label describing what the sparkline represents. */
  ariaLabel: string
}

/**
 * Tiny 7-day area chart used inside dashboard cards. Renders nothing when
 * the series has no real data points (caller decides what to show instead).
 */
export default function Sparkline({
  data,
  color = "#2563eb",
  ariaLabel,
}: SparklineProps) {
  const hasValues = data.some((p) => p.value !== null && p.value !== undefined && p.value !== 0)
  if (!hasValues) {
    return (
      <div
        role="img"
        aria-label={`${ariaLabel} (no data)`}
        className="h-16 w-full rounded-md bg-slate-100"
      />
    )
  }

  // Build a valid SVG id from the label (collapse whitespace then strip any
  // remaining non id-safe characters). Using the raw label can produce ids
  // with spaces/punctuation, which break `url(#...)` references.
  const gradientId = `sparkline-${ariaLabel
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "")}`

  return (
    <div role="img" aria-label={ariaLabel} className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={[...data]}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
