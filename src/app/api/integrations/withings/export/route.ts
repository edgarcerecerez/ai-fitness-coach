import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { apiLogger } from '@/lib/logger';
import { WithingsDataExportService } from '@/lib/withings/data-export-service';

const VALID_EXPORT_TYPES = ['full', 'date_range', 'specific_metrics'];
const VALID_FORMATS = ['json', 'csv', 'pdf'];
const VALID_METRICS = ['weight', 'body_fat', 'muscle_mass', 'bone_mass', 'water_percentage', 'bmi'];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { exportType, format, dateRange, metrics } = body;

    if (!VALID_EXPORT_TYPES.includes(exportType)) {
      return NextResponse.json({ error: `exportType must be one of ${VALID_EXPORT_TYPES.join(', ')}` }, { status: 400 });
    }

    if (!VALID_FORMATS.includes(format)) {
      return NextResponse.json({ error: `format must be one of ${VALID_FORMATS.join(', ')}` }, { status: 400 });
    }

    if (dateRange) {
      if (!dateRange.startDate || !dateRange.endDate) {
        return NextResponse.json({ error: 'dateRange.startDate and dateRange.endDate are required' }, { status: 400 });
      }
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return NextResponse.json({ error: 'Invalid date range provided' }, { status: 400 });
      }
      if (start > end) {
        return NextResponse.json({ error: 'dateRange.startDate must be before endDate' }, { status: 400 });
      }
    }

    if (metrics && Array.isArray(metrics)) {
      const invalid = metrics.filter((metric: string) => !VALID_METRICS.includes(metric));
      if (invalid.length) {
        return NextResponse.json({ error: `Invalid metrics: ${invalid.join(', ')}` }, { status: 400 });
      }
    }

    const exportService = new WithingsDataExportService();
    const exportId = await exportService.initiateExport(user.id, {
      exportType,
      format,
      dateRange: dateRange
        ? { startDate: new Date(dateRange.startDate), endDate: new Date(dateRange.endDate) }
        : undefined,
      includedMetrics: metrics
    });

    return NextResponse.json({ exportId, status: 'initiated' });
  } catch (error) {
    apiLogger.error('Withings export API error', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Failed to create export' }, { status: 500 });
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
    const exportId = url.searchParams.get('exportId');

    if (exportId) {
      const { data, error } = await supabase
        .from('withings_data_exports')
        .select('*')
        .eq('id', exportId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return NextResponse.json({ export: data });
    }

    const { data, error } = await supabase
      .from('withings_data_exports')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    return NextResponse.json({ exports: data ?? [] });
  } catch (error) {
    apiLogger.error('Withings export status API error', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Failed to load exports' }, { status: 500 });
  }
}
