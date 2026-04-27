import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiLogger } from '@/lib/logger'
import {
  buildHealthExport,
  type ExportFormat,
  type MoodLog,
  type NutritionLog,
  type WeightLog,
} from './export-utils'

export const dynamic = 'force-dynamic'

const SUPPORTED_FORMATS: ExportFormat[] = ['json', 'csv', 'pdf']
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /api/analytics/export?format=json|csv|pdf&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Returns the authenticated user's combined health data (weight, nutrition,
 * mood) in the requested format. Date range is optional; both bounds inclusive.
 * RLS on the underlying tables ensures the user only ever sees their own rows.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const formatParam = (searchParams.get('format') || 'json').toLowerCase()
    if (!SUPPORTED_FORMATS.includes(formatParam as ExportFormat)) {
      return NextResponse.json(
        { error: `Unsupported format. Use one of: ${SUPPORTED_FORMATS.join(', ')}` },
        { status: 400 }
      )
    }
    const format = formatParam as ExportFormat

    const start = searchParams.get('start')
    const end = searchParams.get('end')
    if (start && !DATE_REGEX.test(start)) {
      return NextResponse.json({ error: 'Invalid start date. Use YYYY-MM-DD.' }, { status: 400 })
    }
    if (end && !DATE_REGEX.test(end)) {
      return NextResponse.json({ error: 'Invalid end date. Use YYYY-MM-DD.' }, { status: 400 })
    }

    const startISO = start ? `${start}T00:00:00.000Z` : null
    const endISO = end ? `${end}T23:59:59.999Z` : null

    const buildQuery = (table: string, columns: string) => {
      let q = supabase.from(table).select(columns).order('recorded_at', { ascending: true })
      if (startISO) q = q.gte('recorded_at', startISO)
      if (endISO) q = q.lte('recorded_at', endISO)
      return q
    }

    const [weightRes, nutritionRes, moodRes] = await Promise.all([
      buildQuery(
        'weight_logs',
        'id, weight_kg, body_fat_percentage, muscle_mass_kg, source, recorded_at'
      ),
      buildQuery(
        'nutrition_logs',
        'id, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, notes, recorded_at'
      ),
      buildQuery(
        'mood_logs',
        'id, mood_score, energy_level, stress_level, sleep_quality, notes, recorded_at'
      ),
    ])

    const firstError = weightRes.error || nutritionRes.error || moodRes.error
    if (firstError) {
      apiLogger.error('Analytics export query failed', { message: firstError.message })
      return NextResponse.json({ error: 'Failed to load data' }, { status: 500 })
    }

    const payload = {
      generated_at: new Date().toISOString(),
      user_id: user.id,
      range: { start: start || null, end: end || null },
      weight_logs: (weightRes.data ?? []) as unknown as WeightLog[],
      nutrition_logs: (nutritionRes.data ?? []) as unknown as NutritionLog[],
      mood_logs: (moodRes.data ?? []) as unknown as MoodLog[],
    }

    const { body, contentType, filename } = await buildHealthExport(payload, format)

    return new NextResponse(body as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    apiLogger.error('Analytics export error', {
      message: error instanceof Error ? error.message : 'unknown',
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
