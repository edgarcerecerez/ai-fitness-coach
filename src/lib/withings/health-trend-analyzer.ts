import { createClient } from '@/utils/supabase/server';
import { apiLogger } from '@/lib/logger';
import {
  TrendAnalysis,
  TrendPeriod,
  MetricType,
  TrendDirection,
  HealthImpact
} from './types';

interface MetricPoint {
  date: Date;
  value: number;
}

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

    const statistics = this.calculateTrendStatistics(data);
    const healthImpact = this.assessHealthImpact(metric, statistics.trendDirection, statistics.changePercentage);

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
      confidenceLevel: this.calculateConfidenceLevel(statistics.trendStrength, data.length)
    };
  }

  private calculateTrendStatistics(data: MetricPoint[]): {
    changeAbsolute: number;
    changePercentage: number;
    trendDirection: TrendDirection;
    trendStrength: number;
    standardDeviation: number;
    correlationCoefficient: number;
    rSquared: number;
  } {
    const values = data.map(point => point.value);
    const n = values.length;
    const startValue = values[0];
    const endValue = values[n - 1];
    const changeAbsolute = Math.round((endValue - startValue) * 100) / 100;
    const changePercentage = startValue === 0 ? 0 : (changeAbsolute / startValue) * 100;

    const mean = values.reduce((sum, value) => sum + value, 0) / n;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / n;
    const standardDeviation = Math.sqrt(variance);

    const xValues = data.map((_, index) => index);
    const regression = this.linearRegression(xValues, values);

    const trendDirection: TrendDirection = regression.slope > 0.01
      ? 'up'
      : regression.slope < -0.01
        ? 'down'
        : 'stable';

    return {
      changeAbsolute,
      changePercentage,
      trendDirection,
      trendStrength: Math.abs(regression.correlationCoefficient),
      standardDeviation,
      correlationCoefficient: regression.correlationCoefficient,
      rSquared: regression.rSquared
    };
  }

  private linearRegression(x: number[], y: number[]): {
    slope: number;
    intercept: number;
    rSquared: number;
    correlationCoefficient: number;
  } {
    const n = x.length;
    const sumX = x.reduce((sum, value) => sum + value, 0);
    const sumY = y.reduce((sum, value) => sum + value, 0);
    const sumXY = x.reduce((sum, value, index) => sum + value * y[index], 0);
    const sumXX = x.reduce((sum, value) => sum + value * value, 0);
    const _sumYY = y.reduce((sum, value) => sum + value * value, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const meanY = sumY / n;
    const totalSumSquares = y.reduce((sum, value) => sum + Math.pow(value - meanY, 2), 0);
    const residualSumSquares = y.reduce((sum, value, index) => {
      const predicted = slope * x[index] + intercept;
      return sum + Math.pow(value - predicted, 2);
    }, 0);

    const rSquared = totalSumSquares === 0 ? 0 : 1 - residualSumSquares / totalSumSquares;
    const correlationCoefficient = Math.sqrt(Math.max(0, rSquared)) * Math.sign(slope || 0);

    return { slope, intercept, rSquared, correlationCoefficient };
  }

  private assessHealthImpact(
    metric: MetricType,
    trendDirection: TrendDirection,
    changePercentage: number
  ): HealthImpact {
    if (trendDirection === 'stable') {
      return 'neutral';
    }

    const positiveTrend = trendDirection === 'down';

    switch (metric) {
      case 'weight':
      case 'body_fat':
        return positiveTrend ? 'positive' : changePercentage > 2 ? 'negative' : 'neutral';
      case 'muscle_mass':
        return positiveTrend ? 'negative' : 'positive';
      case 'bmi':
        return positiveTrend ? 'positive' : 'negative';
      default:
        return 'neutral';
    }
  }

  private calculateConfidenceLevel(trendStrength: number, dataPoints: number): number {
    const base = trendStrength;
    const dataWeight = Math.min(1, dataPoints / 10);
    return Math.round(((base * 0.7 + dataWeight * 0.3)) * 100) / 100;
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
