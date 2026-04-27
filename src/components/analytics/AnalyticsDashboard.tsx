"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import {
  analysePair,
  buildDailyAggregates,
  filterByWindow,
  type MoodLog,
  type NutritionLog,
  type WeightLog,
} from "@/lib/analytics-engine"
import { CorrelationCard } from "./CorrelationCard"
import { CorrelationScatter } from "./CorrelationScatter"
import { ExportPanel } from "./ExportPanel"
import { FamilySharing } from "./FamilySharing"

type WindowDays = 30 | 90 | 365

const WINDOW_OPTIONS: { value: WindowDays; label: string }[] = [
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 365, label: "Last 365 days" },
]

export function AnalyticsDashboard() {
  const [windowDays, setWindowDays] = useState<WindowDays>(90)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [nutritionLogs, setNutritionLogs] = useState<NutritionLog[]>([])
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    const load = async () => {
      setLoading(true)
      setError(null)
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        if (!cancelled) {
          setError("You must be signed in to view analytics.")
          setLoading(false)
        }
        return
      }

      // Fetch a generous window so window switching works without re-fetching
      const since = new Date()
      since.setUTCDate(since.getUTCDate() - 365)
      const sinceISO = since.toISOString()

      const [w, n, m] = await Promise.all([
        supabase
          .from("weight_logs")
          .select("recorded_at, weight_kg")
          .gte("recorded_at", sinceISO)
          .order("recorded_at", { ascending: true }),
        supabase
          .from("nutrition_logs")
          .select("recorded_at, total_calories")
          .gte("recorded_at", sinceISO)
          .order("recorded_at", { ascending: true }),
        supabase
          .from("mood_logs")
          .select("recorded_at, mood_score")
          .gte("recorded_at", sinceISO)
          .order("recorded_at", { ascending: true }),
      ])

      if (cancelled) return
      const firstError = w.error || n.error || m.error
      if (firstError) {
        setError(firstError.message)
      } else {
        setWeightLogs((w.data ?? []) as WeightLog[])
        setNutritionLogs((n.data ?? []) as NutritionLog[])
        setMoodLogs((m.data ?? []) as MoodLog[])
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const dailyAggregates = useMemo(
    () => buildDailyAggregates(weightLogs, nutritionLogs, moodLogs),
    [weightLogs, nutritionLogs, moodLogs]
  )

  const windowed = useMemo(
    () => filterByWindow(dailyAggregates, windowDays),
    [dailyAggregates, windowDays]
  )

  const weightVsCalories = useMemo(
    () => analysePair(windowed, "calories", "weight_kg"),
    [windowed]
  )
  const weightVsMood = useMemo(
    () => analysePair(windowed, "mood_score", "weight_kg"),
    [windowed]
  )
  const moodVsCalories = useMemo(
    () => analysePair(windowed, "calories", "mood_score"),
    [windowed]
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Advanced analytics</CardTitle>
            <CardDescription>
              Spot relationships between your weight, daily calories, and mood.
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <label htmlFor="window" className="text-muted-foreground text-xs">
              Window
            </label>
            <select
              id="window"
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value) as WindowDays)}
              className="border-input bg-background h-9 rounded-md border px-3 py-1 text-sm"
            >
              {WINDOW_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> Loading your data…
            </div>
          ) : error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Analyzing {windowed.length} {windowed.length === 1 ? "day" : "days"} of activity.
            </p>
          )}
        </CardContent>
      </Card>

      {!loading && !error && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <CorrelationCard
              title="Weight vs Calories"
              description="Does eating more correlate with weighing more?"
              result={weightVsCalories.correlation}
            />
            <CorrelationCard
              title="Weight vs Mood"
              description="Does your weight track with how you feel?"
              result={weightVsMood.correlation}
            />
            <CorrelationCard
              title="Mood vs Calories"
              description="Do higher-calorie days correlate with mood swings?"
              result={moodVsCalories.correlation}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CorrelationScatter
              title="Weight vs Calories"
              xLabel="Calories (kcal)"
              yLabel="Weight (kg)"
              points={weightVsCalories.points}
              trend={weightVsCalories.trend}
            />
            <CorrelationScatter
              title="Weight vs Mood"
              xLabel="Mood (1–10)"
              yLabel="Weight (kg)"
              points={weightVsMood.points}
              trend={weightVsMood.trend}
            />
            <CorrelationScatter
              title="Mood vs Calories"
              xLabel="Calories (kcal)"
              yLabel="Mood (1–10)"
              points={moodVsCalories.points}
              trend={moodVsCalories.trend}
            />
          </div>

          <ExportPanel />
          <FamilySharing />
        </>
      )}
    </div>
  )
}
