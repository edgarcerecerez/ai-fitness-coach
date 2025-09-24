
import {
  MetricType,
  TrendDirection,
  HealthImpact,
} from '@/lib/withings/types';

export interface MetricPoint {
  readonly date: Date;
  readonly value: number;
}

export class TrendDetection {
  static calculateTrendStatistics(data: MetricPoint[]): {
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

  static linearRegression(x: number[], y: number[]): {
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

  static assessHealthImpact(
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

  static calculateConfidenceLevel(trendStrength: number, dataPoints: number): number {
    const base = trendStrength;
    const dataWeight = Math.min(1, dataPoints / 10);
    return Math.round(((base * 0.7 + dataWeight * 0.3)) * 100) / 100;
  }
}
