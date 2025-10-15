import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getInngestClient } from '@/lib/inngest/client';
import { apiLogger } from '@/lib/logger';

interface EventData {
  userId: string;
  options: {
    startDate?: string;
    endDate?: string;
    measurementTypes?: string[];
  };
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has an active Withings connection
    const { data: connection } = await supabase
      .from('withings_connections')
      .select('id, is_active')
      .eq('user_id', user.id)
      .single();

    if (!connection || !connection.is_active) {
      return NextResponse.json(
        { error: 'No active Withings connection found' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { startDate, endDate, measurementTypes, syncType = 'manual' } = body;

    // Validate date range if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format' },
          { status: 400 }
        );
      }
      if (start > end) {
        return NextResponse.json(
          { error: 'Start date must be before end date' },
          { status: 400 }
        );
      }
    }

    try {
      const inngest = getInngestClient();
      
      // Queue appropriate sync job with Inngest
      const eventName = syncType === 'historical' 
        ? 'withings/sync.historical' 
        : 'withings/sync.manual';
      
      const eventData: EventData = {
        userId: user.id,
        options: {
          startDate,
          endDate,
          measurementTypes
        }
      };

      if (syncType === 'historical') {
        eventData.dateRange = { startDate, endDate };
      }

      const event = await inngest.send({
        name: eventName,
        data: {
          ...eventData,
          eventId: crypto.randomUUID()
        }
      });

      apiLogger.info('Withings sync job queued', {
        userId: user.id,
        syncType,
        eventId: event.ids[0]
      });

      return NextResponse.json({ 
        eventId: event.ids[0], 
        status: 'queued',
        message: `${syncType === 'historical' ? 'Historical' : 'Manual'} sync job queued successfully`,
        syncType
      });
    } catch (inngestError: unknown) {
      apiLogger.error('Failed to queue sync job with Inngest', {
        userId: user.id,
        error: inngestError
      });
      
      return NextResponse.json(
        { error: 'Sync service temporarily unavailable' },
        { status: 503 }
      );
    }
  } catch (error: unknown) {
    apiLogger.error('Manual sync API error', {
      error
    });
    
    return NextResponse.json(
      { error: 'Failed to queue sync job' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

    // Get sync job history for the user
    const { data: syncJobs } = await supabase
      .from('withings_sync_jobs')
      .select(`
        id,
        job_type,
        status,
        start_date,
        end_date,
        measurements_requested,
        measurements_processed,
        measurements_synced,
        measurements_skipped,
        error_message,
        created_at,
        updated_at,
        completed_at,
        withings_connections!inner(user_id)
      `)
      .eq('withings_connections.user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Get conflict statistics
    const { data: conflicts } = await supabase
      .from('withings_data_conflicts')
      .select('conflict_type, resolved_at')
      .eq('user_id', user.id);

    const conflictStats = {
      total: conflicts?.length || 0,
      resolved: conflicts?.filter(c => c.resolved_at).length || 0,
      pending: conflicts?.filter(c => !c.resolved_at).length || 0
    };

    return NextResponse.json({
      syncJobs: syncJobs || [],
      conflictStats
    });
  } catch (error: unknown) {
    apiLogger.error('Sync history API error', {
      error
    });
    
    return NextResponse.json(
      { error: 'Failed to fetch sync history' },
      { status: 500 }
    );
  }
}