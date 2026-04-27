import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import HealthInsightsView from "@/components/dashboard/HealthInsightsView"
import {
  formatLatestMood,
  formatLatestWeight,
  formatTodayCalories,
} from "@/lib/dashboard-format"
import { logError } from "@/lib/logger"
import type { WeightUnit } from "@/lib/weight-conversion"

export const dynamic = "force-dynamic"

const SEVEN_DAYS_AGO_ISO = () =>
  new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()

/**
 * Unified protected dashboard. Server-component fetches the most recent week
 * of data from each health table and hands the shaped values to
 * `<HealthInsightsView />`. Auth is enforced by the route-group layout, but
 * we re-check here so the queries always run with a known user id.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const since = SEVEN_DAYS_AGO_ISO()

  const [weightRes, nutritionRes, moodRes, profileRes] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("weight_kg, recorded_at")
      .eq("user_id", user.id)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false }),
    supabase
      .from("nutrition_logs")
      .select("total_calories, recorded_at")
      .eq("user_id", user.id)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false }),
    supabase
      .from("mood_logs")
      .select("mood_score, recorded_at")
      .eq("user_id", user.id)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false }),
    supabase
      .from("user_profiles")
      .select("preferences")
      .eq("id", user.id)
      .maybeSingle(),
  ])

  for (const res of [weightRes, nutritionRes, moodRes, profileRes]) {
    if (res.error) {
      logError(res.error, "Dashboard data fetch failed")
    }
  }

  const preferredUnit =
    ((profileRes.data?.preferences as { weightUnit?: WeightUnit } | null)
      ?.weightUnit ?? "kg") as WeightUnit

  const weight = formatLatestWeight(weightRes.data ?? [], preferredUnit)
  const calories = formatTodayCalories(nutritionRes.data ?? [])
  const mood = formatLatestMood(moodRes.data ?? [])

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Your health at a glance
        </h1>
        <p className="text-sm text-slate-600">
          A combined view of weight, nutrition, and mood from the last 7 days.
        </p>
      </header>
      <HealthInsightsView weight={weight} calories={calories} mood={mood} />
    </div>
  )
}
