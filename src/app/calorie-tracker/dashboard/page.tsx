import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { NutritionLog } from '@/lib/nutrition-types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import CalorieDashboard from '@/components/calorie-dashboard/CalorieDashboard'

// Dashboards should always reflect the freshest logs.
export const dynamic = 'force-dynamic'

// Cap the lookback to keep payloads bounded; 30 days easily covers the
// "Today / This Week / Last 7 Days" toggles plus a small margin.
const LOOKBACK_DAYS = 30

/**
 * Server-rendered calorie dashboard. Fetches the authenticated user's recent
 * nutrition logs (with fresh signed image URLs) and hands them to the client
 * dashboard component for chart rendering, filtering, and CRUD.
 */
export default async function CalorieDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch logs from the last LOOKBACK_DAYS to power both today and weekly views
  const since = new Date()
  since.setDate(since.getDate() - LOOKBACK_DAYS)

  const { data: rawLogs, error: dbError } = await supabase
    .from('nutrition_logs')
    .select(
      'id, user_id, food_items, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, image_url, image_path, confidence_score, notes, logged_at, created_at, updated_at'
    )
    .gte('logged_at', since.toISOString())
    .order('logged_at', { ascending: false })

  if (dbError) {
    console.error('Failed to load nutrition logs', dbError)
    // Surface to the route error boundary instead of falling back to an empty
    // array (which would misleadingly show "No meals logged yet").
    throw new Error('Failed to load nutrition logs')
  }

  // Refresh signed URLs in a single batched call so thumbnails render even
  // when the stored URLs have expired. The logs were just fetched with RLS
  // applied (auth.uid() = user_id), so each image_path is owned by `user`.
  const imagePaths = (rawLogs ?? [])
    .map((log) => log.image_path)
    .filter((path): path is string => Boolean(path))

  const signedUrlByPath = new Map<string, string>()
  if (imagePaths.length > 0) {
    const { data: signedResults } = await supabase.storage
      .from('meal-images')
      .createSignedUrls(imagePaths, 3600)
    for (const result of signedResults ?? []) {
      if (result.path && result.signedUrl) {
        signedUrlByPath.set(result.path, result.signedUrl)
      }
    }
  }

  const logs: NutritionLog[] = (rawLogs ?? []).map((log) => ({
    ...log,
    image_url: log.image_path ? signedUrlByPath.get(log.image_path) : undefined,
  })) as NutritionLog[]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Calorie Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Daily and weekly nutrition at a glance.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/calorie-tracker">
              <ArrowLeft className="h-4 w-4" />
              Back to logging
            </Link>
          </Button>
        </div>

        {logs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <p className="text-base font-medium">No meals logged yet</p>
              <p className="text-sm text-muted-foreground">
                Log your first meal to see daily totals and trends here.
              </p>
              <Button asChild>
                <Link href="/calorie-tracker">Log a meal</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <CalorieDashboard initialLogs={logs} />
        )}
      </div>
    </div>
  )
}
