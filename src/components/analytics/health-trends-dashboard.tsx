
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TrendData {
  readonly metric_type: string;
  readonly trend_period: string;
  readonly trend_direction: string;
  readonly change_percentage: number;
  readonly health_impact: string;
}

async function fetchTrends(supabase: SupabaseClient): Promise<TrendData[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('withings_health_trends')
    .select('metric_type, trend_period, trend_direction, change_percentage, health_impact')
    .eq('user_id', user.id)
    .order('analysis_date', { ascending: false });

  if (error) {
    console.error('Error fetching health trends:', error);
    return [];
  }
  return data || [];
}

export function HealthTrendsDashboard() {
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadTrends = useCallback(async () => {
    setLoading(true);
    const trendsData = await fetchTrends(supabase);
    setTrends(trendsData);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  if (loading) {
    return <div>Loading trends...</div>;
  }

  if (trends.length === 0) {
    return <div>No trend data available.</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {trends.map((trend, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>{trend.metric_type.replaceAll('_', ' ')}</span>
              <Badge>{trend.trend_period}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <span className={`text-2xl font-bold ${trend.health_impact === 'positive' ? 'text-green-500' : trend.health_impact === 'negative' ? 'text-red-500' : ''}`}>
                {trend.trend_direction === 'up' ? '▲' : trend.trend_direction === 'down' ? '▼' : '●'}
                {trend.change_percentage.toFixed(1)}%
              </span>
              <Badge variant={trend.health_impact === 'positive' ? 'default' : trend.health_impact === 'negative' ? 'destructive' : 'secondary'}>
                {trend.health_impact}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{trend.trend_direction}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
