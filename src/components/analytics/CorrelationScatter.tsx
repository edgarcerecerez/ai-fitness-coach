"use client"

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ScatterPoint, TrendLine } from "@/lib/analytics-engine"

interface CorrelationScatterProps {
  title: string
  description?: string
  xLabel: string
  yLabel: string
  points: ScatterPoint[]
  trend: TrendLine | null
}

/**
 * Renders a scatter plot of (x, y) observations with an optional trend line
 * computed by the analytics engine. Falls back to an empty-state message when
 * there is nothing to plot.
 */
export function CorrelationScatter({
  title,
  description,
  xLabel,
  yLabel,
  points,
  trend,
}: CorrelationScatterProps) {
  const trendData = (() => {
    if (points.length === 0 || !trend) return []
    let minX = points[0].x
    let maxX = points[0].x
    for (const p of points) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
    }
    if (minX === maxX) return []
    return [
      { x: minX, y: trend.slope * minX + trend.intercept },
      { x: maxX, y: trend.slope * maxX + trend.intercept },
    ]
  })()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <div className="text-muted-foreground flex h-56 items-center justify-center text-sm">
            Not enough overlapping data yet.
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={xLabel}
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 11 }}
                  label={{ value: xLabel, position: "insideBottom", offset: -4, fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={yLabel}
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 11 }}
                  label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 11 }}
                />
                <ZAxis range={[40, 40]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(value: number | string) =>
                    typeof value === "number" ? value.toFixed(2) : value
                  }
                />
                <Scatter data={points} fill="var(--primary)" />
                {trendData.length > 0 && (
                  <Line
                    data={trendData}
                    dataKey="y"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    type="linear"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
