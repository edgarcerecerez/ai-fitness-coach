
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AIInsight {
  readonly insight_type: string;
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly importance_level: string;
}

async function fetchInsights(supabase: SupabaseClient): Promise<AIInsight[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('withings_ai_insights')
    .select('insight_type, category, title, description, importance_level')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching AI insights:', error);
    return [];
  }
  return data || [];
}

export function AIInsightsPanel() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadInsights = useCallback(async () => {
    setLoading(true);
    const insightsData = await fetchInsights(supabase);
    setInsights(insightsData);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  if (loading) {
    return <div>Loading insights...</div>;
  }

  if (insights.length === 0) {
    return <div>No new insights available.</div>;
  }

  const getImportanceColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-yellow-500';
      case 'medium':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-4">
      {insights.map((insight, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              {insight.title}
              <Badge className={getImportanceColor(insight.importance_level)}>{insight.importance_level}</Badge>
            </CardTitle>
            <CardDescription>{insight.category.replaceAll('_', ' ')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p>{insight.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
