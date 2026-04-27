import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

interface SubscribeBody {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
  userAgent?: string
}

/**
 * Stores a Web Push subscription for the authenticated user.
 *
 * Idempotent: subscriptions are upserted on `endpoint`, so repeated calls
 * from the same browser refresh the row instead of creating duplicates.
 */
export async function POST(request: Request) {
  let body: SubscribeBody
  try {
    body = (await request.json()) as SubscribeBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const endpoint = body.endpoint
  const p256dh = body.keys?.p256dh
  const auth = body.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: 'Missing endpoint or keys' },
      { status: 400 }
    )
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
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: body.userAgent ?? null,
      },
      { onConflict: 'endpoint' }
    )

  if (error) {
    console.error('Failed to upsert push subscription', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
