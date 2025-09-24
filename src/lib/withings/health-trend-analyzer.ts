import { createClient } from '@/utils/supabase/server';
import { apiLogger } from '@/lib/logger';
import {
  TrendAnalysis,
  TrendPeriod,
  MetricType,
} from './types';
import { TrendDetection, MetricPoint } from '@/lib/analytics/trend-detection';

export class HealthTrendAnalyzer {
  async analyzeHealthTrends(userId: string): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];
    const periods: TrendPeriod[] = ['weekly', 'monthly', 'quarterly'];
    const metrics: MetricType[] = ['weight', 'body_fat', 'muscle_mass', 'bmi'];

    for (const period of periods) {
      for (const metric of metrics) {
        try {
          const trend = await this.analyzeTrend(userId, metric, period);
          if (trend) {
            trends.push(trend);
            await this.storeTrendAnalysis(userId, trend);
          }
        } catch (error) {
          apiLogger.error('Failed to calculate Withings trend', {
            userId,
            metric,
            period,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    return trends;
  }

  private async analyzeTrend(
    userId: string,
    metric: MetricType,
    period: TrendPeriod
  ): Promise<TrendAnalysis | null> {
    const timeWindow = this.getTimeWindow(period);
    const data = await this.getMetricData(userId, metric, timeWindow.start, timeWindow.end);

    if (data.length < 3) {
      return null;
    }

    const statistics = TrendDetection.calculateTrendStatistics(data);
    const healthImpact = TrendDetection.assessHealthImpact(metric, statistics.trendDirection, statistics.changePercentage);

    return {
      userId,
      metricType: metric,
      trendPeriod: period,
      analysisDate: new Date(),
      startValue: data[0].value,
      endValue: data[data.length - 1].value,
      changeAbsolute: statistics.changeAbsolute,
      changePercentage: statistics.changePercentage,
      trendDirection: statistics.trendDirection,
      trendStrength: statistics.trendStrength,
      dataPointsCount: data.length,
      standardDeviation: statistics.standardDeviation,
      correlationCoefficient: statistics.correlationCoefficient,
      rSquared: statistics.rSquared,
      healthImpact,
      confidenceLevel: TrendDetection.calculateConfidenceLevel(statistics.trendStrength, data.length)
    };
  }

  private async storeTrendAnalysis(userId: string, trend: TrendAnalysis): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('withings_health_trends')
      .upsert({
        user_id: userId,
        metric_type: trend.metricType,
        trend_period: trend.trendPeriod,
        analysis_date: trend.analysisDate.toISOString(),
        start_value: trend.startValue,
        end_value: trend.endValue,
        change_absolute: trend.changeAbsolute,
        change_percentage: Math.round(trend.changePercentage * 100) / 100,
        trend_direction: trend.trendDirection,
        trend_strength: trend.trendStrength,
        data_points_count: trend.dataPointsCount,
        standard_deviation: trend.standardDeviation,
        correlation_coefficient: trend.correlationCoefficient,
        r_squared: trend.rSquared,
        health_impact: trend.healthImpact,
        confidence_level: trend.confidenceLevel
      }, { onConflict: 'user_id,metric_type,trend_period,analysis_date' });

    if (error) {
      throw new Error(`Failed to store trend analysis: ${error.message}`);
    }
  }

  private getTimeWindow(period: TrendPeriod): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date(end);

    switch (period) {
      case 'weekly':
        start.setDate(end.getDate() - 7);
        break;
      case 'monthly':
        start.setDate(end.getDate() - 30);
        break;
      case 'quarterly':
        start.setDate(end.getDate() - 90);
        break;
      default:
        start.setDate(end.getDate() - 30);
        break;
    }

    return { start, end };
  }

  private async getMetricData(
    userId: string,
    metric: MetricType,
    start: Date,
    end: Date
  ): Promise<MetricPoint[]> {
    const supabase = await createClient();

    if (metric === 'weight') {
      const { data, error } = await supabase
        .from('weight_logs')
        .select('logged_at, weight_kg')
        .eq('user_id', userId)
        .eq('sync_status', 'synced')
        .gte('logged_at', start.toISOString())
        .lte('logged_at', end.toISOString())
        .order('logged_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to load weight data: ${error.message}`);
      }

      return (data || [])
        .filter(entry => entry.weight_kg != null)
        .map(entry => ({
          date: new Date(entry.logged_at),
          value: Number(entry.weight_kg)
        }));
    }

    const columnMap: Record<MetricType, string> = {
      body_fat: 'body_fat_percentage',
      muscle_mass: 'muscle_mass_kg',
      bmi: 'bmi',
      weight: 'weight_kg'
    };

    const { data, error } = await supabase
      .from('withings_body_composition_analysis')
      .select('analysis_date, ' + columnMap[metric])
      .eq('user_id', userId)
      .gte('analysis_date', start.toISOString())
      .lte('analysis_date', end.toISOString())
      .order('analysis_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to load body composition data: ${error.message}`);
    }

    const points: MetricPoint[] = [];
    for (const entry of data || []) {
      const value = entry[columnMap[metric] as keyof typeof entry];
      if (value != null) {
        points.push({
          date: new Date(entry['analysis_date' as keyof typeof entry] as string),
          value: Number(value)
        });
      }
    }

    return points;
  }
}
