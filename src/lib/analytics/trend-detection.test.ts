
import { TrendDetection, MetricPoint } from './trend-detection';

describe('TrendDetection', () => {
  const data: MetricPoint[] = [
    { date: new Date('2025-01-01'), value: 80 },
    { date: new Date('2025-01-02'), value: 80.5 },
    { date: new Date('2025-01-03'), value: 81 },
    { date: new Date('2025-01-04'), value: 80.8 },
    { date: new Date('2025-01-05'), value: 81.2 },
    { date: new Date('2025-01-06'), value: 81.5 },
    { date: new Date('2025-01-07'), value: 81.7 },
  ];

  it('calculates trend statistics correctly', () => {
    const stats = TrendDetection.calculateTrendStatistics(data);
    expect(stats.trendDirection).toBe('up');
    expect(stats.trendStrength).toBeGreaterThan(0.8);
  });

  it('assesses health impact correctly', () => {
    const impact = TrendDetection.assessHealthImpact('weight', 'up', 2);
    expect(impact).toBe('neutral');
  });

  it('calculates confidence level correctly', () => {
    const confidence = TrendDetection.calculateConfidenceLevel(0.9, 7);
    expect(confidence).toBeCloseTo(0.7);
  });
});
