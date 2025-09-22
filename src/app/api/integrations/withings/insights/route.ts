import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { apiLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const includeDismissed = url.searchParams.get('includeDismissed') === 'true';
    const limit = Number(url.searchParams.get('limit') ?? '20');

    let query = supabase
      .from('withings_ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(Number.isFinite(limit) ? limit : 20);

    if (!includeDismissed) {
      query = query.eq('is_dismissed', false);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ insights: data ?? [] });
  } catch (error) {
    apiLogger.error('Withings insights fetch failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Failed to load insights' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { insightId, isRead, isDismissed, feedback } = body;

    if (!insightId) {
      return NextResponse.json({ error: 'insightId is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof isRead === 'boolean') updates.is_read = isRead;
    if (typeof isDismissed === 'boolean') updates.is_dismissed = isDismissed;
    if (feedback != null) updates.user_feedback = Number(feedback);

    const { data, error } = await supabase
      .from('withings_ai_insights')
      .update(updates)
      .eq('id', insightId)
      .eq('user_id', user.id)
      .select('*')
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ insight: data });
  } catch (error) {
    apiLogger.error('Withings insight update failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Failed to update insight' }, { status: 500 });
  }
}
