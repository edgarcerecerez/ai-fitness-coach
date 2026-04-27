import Link from "next/link"
import { ArrowRight, Flame, Scale, Smile } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import Sparkline from "./Sparkline"
import type {
  LatestCalories,
  LatestMood,
  LatestWeight,
} from "@/lib/dashboard-format"

interface HealthInsightsViewProps {
  weight: LatestWeight
  calories: LatestCalories
  mood: LatestMood
}

interface InsightCardProps {
  title: string
  description: string
  icon: React.ReactNode
  value: string
  hasData: boolean
  emptyHint: string
  href: string
  ctaLabel: string
  sparkline: React.ReactNode
}

function InsightCard({
  title,
  description,
  icon,
  value,
  hasData,
  emptyHint,
  href,
  ctaLabel,
  sparkline,
}: InsightCardProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p
          className={
            hasData
              ? "text-3xl font-semibold text-slate-900"
              : "text-base text-slate-500"
          }
        >
          {value}
        </p>
        {sparkline}
        {!hasData && <p className="text-xs text-slate-500">{emptyHint}</p>}
        <div className="mt-auto">
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Renders the three primary health-insight cards (weight, calories, mood)
 * for the unified dashboard. Pure presentational; data shaping happens in
 * `src/lib/dashboard-format.ts` and the page-level server component.
 */
export default function HealthInsightsView({
  weight,
  calories,
  mood,
}: HealthInsightsViewProps) {
  const cards: ReadonlyArray<
    Omit<InsightCardProps, "sparkline"> & { sparklineColor: string; sparklineKey: string; series: LatestWeight["series"] }
  > = [
    {
      title: "Latest Weight",
      description: "Most recent reading",
      icon: <Scale className="h-5 w-5 text-blue-600" />,
      value: weight.display,
      hasData: weight.hasData,
      emptyHint: "Log a weight to start tracking trends.",
      href: "/profile",
      ctaLabel: "Manage profile",
      series: weight.series,
      sparklineColor: "#2563eb",
      sparklineKey: "7-day weight trend",
    },
    {
      title: "Today's Calories",
      description: "Sum of meals logged today",
      icon: <Flame className="h-5 w-5 text-orange-500" />,
      value: calories.display,
      hasData: calories.hasData,
      emptyHint: "Snap a meal to see calories appear here.",
      href: "/calorie-tracker",
      ctaLabel: "Open calorie tracker",
      series: calories.series,
      sparklineColor: "#f97316",
      sparklineKey: "7-day calorie trend",
    },
    {
      title: "Latest Mood",
      description: "Most recent mood score",
      icon: <Smile className="h-5 w-5 text-purple-600" />,
      value: mood.display,
      hasData: mood.hasData,
      emptyHint: "Mood logging unlocks holistic insights.",
      href: "/analytics",
      ctaLabel: "Open analytics",
      series: mood.series,
      sparklineColor: "#9333ea",
      sparklineKey: "7-day mood trend",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map(({ sparklineColor, sparklineKey, series, ...card }) => (
        <InsightCard
          key={card.title}
          {...card}
          sparkline={
            <Sparkline
              data={series}
              color={sparklineColor}
              ariaLabel={sparklineKey}
            />
          }
        />
      ))}
    </div>
  )
}
