import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

interface UnsubscribeBody {
  endpoint?: string
}

/**
 * Removes a Web Push subscription for the authenticated user. RLS ensures a
 * user can only delete their own rows, even if they specify another user's
 * endpoint.
 */
export async function DELETE(request: Request) {
  let body: UnsubscribeBody
  try {
    body = (await request.json()) as UnsubscribeBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const endpoint =
    typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
  if (endpoint === '') {
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
  }

  try {
    // Validate that endpoint is a parseable URL before hitting the DB.
    new URL(endpoint)
  } catch {
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  if (error) {
    console.error('Failed to delete push subscription', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
