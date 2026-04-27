import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface NutritionLogPatchBody {
  food_items?: unknown
  total_calories?: number
  total_protein_g?: number
  total_carbs_g?: number
  total_fat_g?: number
  total_fiber_g?: number
  notes?: string | null
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * PATCH /api/nutrition-logs/[id]
 *
 * Allow the authenticated owner of a nutrition log to update editable fields
 * (macros, food items, notes). RLS still enforces ownership at the DB layer;
 * the explicit `eq('user_id', user.id)` filter is defense-in-depth.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let parsedBody: unknown
    try {
      parsedBody = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    if (
      !parsedBody ||
      typeof parsedBody !== 'object' ||
      Array.isArray(parsedBody)
    ) {
      return NextResponse.json(
        { error: 'Request body must be an object' },
        { status: 400 }
      )
    }

    const body = parsedBody as NutritionLogPatchBody

    const updates: Record<string, unknown> = {}

    if (body.food_items !== undefined) {
      if (!Array.isArray(body.food_items)) {
        return NextResponse.json(
          { error: 'food_items must be an array' },
          { status: 400 }
        )
      }
      updates.food_items = body.food_items
    }

    const numericFields: (keyof NutritionLogPatchBody)[] = [
      'total_calories',
      'total_protein_g',
      'total_carbs_g',
      'total_fat_g',
      'total_fiber_g',
    ]
    for (const field of numericFields) {
      const value = body[field]
      if (value === undefined) continue
      if (!isNonNegativeNumber(value)) {
        return NextResponse.json(
          { error: `${field} must be a non-negative number` },
          { status: 400 }
        )
      }
      updates[field] = value
    }

    if (body.notes !== undefined) {
      if (body.notes !== null && typeof body.notes !== 'string') {
        return NextResponse.json(
          { error: 'notes must be a string or null' },
          { status: 400 }
        )
      }
      updates.notes = body.notes
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No updatable fields provided' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('nutrition_logs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Database error (PATCH nutrition log):', error)
      return NextResponse.json(
        { error: 'Failed to update nutrition log' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('API error (PATCH nutrition log):', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/nutrition-logs/[id]
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Look up the row first so we can clean up the linked storage object on
    // success and return a clean 404 when the row is missing.
    const { data: existing, error: fetchError } = await supabase
      .from('nutrition_logs')
      .select('image_path')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError) {
      console.error('Database error (DELETE nutrition log lookup):', fetchError)
      return NextResponse.json(
        { error: 'Failed to delete nutrition log' },
        { status: 500 }
      )
    }

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from('nutrition_logs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Database error (DELETE nutrition log):', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete nutrition log' },
        { status: 500 }
      )
    }

    // Best-effort: remove the associated meal image so it does not orphan in
    // storage. A failure here must not fail the request — the row is gone.
    if (existing.image_path) {
      const { error: storageError } = await supabase.storage
        .from('meal-images')
        .remove([existing.image_path])
      if (storageError) {
        console.error(
          'Storage cleanup failed (DELETE nutrition log):',
          storageError
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error (DELETE nutrition log):', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
