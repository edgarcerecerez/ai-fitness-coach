"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { CorrelationResult } from "@/lib/analytics-engine"

interface CorrelationCardProps {
  title: string
  description: string
  result: CorrelationResult
}

const STRENGTH_LABEL: Record<CorrelationResult["strength"], string> = {
  insufficient_data: "Not enough data",
  none: "No correlation",
  weak: "Weak",
  moderate: "Moderate",
  strong: "Strong",
}

const STRENGTH_VARIANT: Record<
  CorrelationResult["strength"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  insufficient_data: "outline",
  none: "secondary",
  weak: "outline",
  moderate: "default",
  strong: "default",
}

export function CorrelationCard({ title, description, result }: CorrelationCardProps) {
  const rDisplay = result.r === null ? "—" : result.r.toFixed(2)
  const directionLabel =
    result.direction === "positive"
      ? "Positive"
      : result.direction === "negative"
      ? "Negative"
      : ""

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <div className="text-3xl font-semibold tabular-nums">{rDisplay}</div>
          <div className="text-muted-foreground text-xs">
            n = {result.n} {result.n === 1 ? "day" : "days"}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={STRENGTH_VARIANT[result.strength]}>
            {STRENGTH_LABEL[result.strength]}
          </Badge>
          {directionLabel && (
            <span className="text-muted-foreground text-xs">{directionLabel}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
