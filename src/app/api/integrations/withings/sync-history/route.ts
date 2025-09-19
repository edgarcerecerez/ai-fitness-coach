import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Get the user's profile ID first
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get sync jobs for the user's connections
    const { data: jobs, error } = await supabase
      .from('withings_sync_jobs')
      .select(`
        *,
        connection:withings_connections!inner(user_id)
      `)
      .eq('connection.user_id', profile.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Failed to fetch sync history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sync history' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from('withings_sync_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('connection.user_id', profile.id);

    if (countError) {
      console.error('Failed to get sync history count:', countError);
    }

    return NextResponse.json({
      jobs: jobs.map(job => ({
        id: job.id,
        type: job.job_type,
        status: job.status,
        progress: {
          requested: job.measurements_requested || 0,
          processed: job.measurements_processed || 0,
          synced: job.measurements_synced || 0,
          skipped: job.measurements_skipped || 0
        },
        error: job.error_message,
        errorCode: job.error_code,
        retryCount: job.retry_count || 0,
        maxRetries: job.max_retries || 3,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        completedAt: job.completed_at,
        startDate: job.start_date,
        endDate: job.end_date,
        inngestEventId: job.inngest_event_id
      })),
      pagination: {
        total: totalCount || 0,
        limit,
        offset,
        hasMore: offset + limit < (totalCount || 0)
      }
    });
  } catch (error) {
    console.error('Sync history API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}