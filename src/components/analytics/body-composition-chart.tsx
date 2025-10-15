
"use client";

import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { createClient } from '@/utils/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

interface BodyCompositionData {
  readonly analysis_date: string;
  readonly weight_kg: number;
  readonly body_fat_percentage: number;
  readonly muscle_mass_kg: number;
}

async function fetchBodyCompositionData(supabase: SupabaseClient): Promise<BodyCompositionData[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('withings_body_composition_analysis')
    .select('analysis_date, weight_kg, body_fat_percentage, muscle_mass_kg')
    .eq('user_id', user.id)
    .order('analysis_date', { ascending: true });

  if (error) {
    console.error('Error fetching body composition data:', error);
    return [];
  }
  return data || [];
}

export function BodyCompositionChart() {
  const [data, setData] = useState<BodyCompositionData[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);
    const chartData = await fetchBodyCompositionData(supabase);
    setData(chartData);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (data.length === 0) {
    return <div>No data available to display.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="analysis_date" tickFormatter={(date) => new Date(date).toLocaleDateString()} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="weight_kg" stroke="#8884d8" name="Weight (kg)" />
        <Line type="monotone" dataKey="body_fat_percentage" stroke="#82ca9d" name="Body Fat (%)" />
        <Line type="monotone" dataKey="muscle_mass_kg" stroke="#ffc658" name="Muscle Mass (kg)" />
      </LineChart>
    </ResponsiveContainer>
  );
}
