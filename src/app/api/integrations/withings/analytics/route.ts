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
    const type = url.searchParams.get('type') ?? 'summary';
    const limit = Number(url.searchParams.get('limit') ?? '20');

    switch (type) {
      case 'body-composition': {
        const { data, error } = await supabase
          .from('withings_body_composition_analysis')
          .select('*')
          .eq('user_id', user.id)
          .order('analysis_date', { ascending: false })
          .limit(Number.isFinite(limit) ? limit : 20);

        if (error) throw error;
        return NextResponse.json({ analysis: data ?? [] });
      }
      case 'trends': {
        const period = url.searchParams.get('period');
        let query = supabase
          .from('withings_health_trends')
          .select('*')
          .eq('user_id', user.id)
          .order('analysis_date', { ascending: false })
          .limit(Number.isFinite(limit) ? limit : 20);

        if (period) {
          query = query.eq('trend_period', period);
        }

        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json({ trends: data ?? [] });
      }
      case 'insights': {
        const { data, error } = await supabase
          .from('withings_ai_insights')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(Number.isFinite(limit) ? limit : 20);

        if (error) throw error;
        return NextResponse.json({ insights: data ?? [] });
      }
      case 'summary':
      default: {
        const [latestAnalysis, latestTrend, activeInsights] = await Promise.all([
          supabase
            .from('withings_body_composition_analysis')
            .select('*')
            .eq('user_id', user.id)
            .order('analysis_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('withings_health_trends')
            .select('*')
            .eq('user_id', user.id)
            .order('analysis_date', { ascending: false })
            .limit(5),
          supabase
            .from('withings_ai_insights')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(5)
        ]);

        return NextResponse.json({
          latestAnalysis: latestAnalysis.data ?? null,
          trends: latestTrend.data ?? [],
          insights: activeInsights.data ?? []
        });
      }
    }
  } catch (error) {
    apiLogger.error('Withings analytics API error', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
