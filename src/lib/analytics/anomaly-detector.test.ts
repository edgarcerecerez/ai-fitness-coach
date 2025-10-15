
import { AnomalyDetector } from './anomaly-detector';
import { MetricPoint } from './trend-detection';

describe('AnomalyDetector', () => {
  const data: MetricPoint[] = [
    { date: new Date('2025-01-01'), value: 80 },
    { date: new Date('2025-01-02'), value: 80.5 },
    { date: new Date('2025-01-03'), value: 81 },
    { date: new Date('2025-01-04'), value: 80.8 },
    { date: new Date('2025-01-05'), value: 81.2 },
    { date: new Date('2025-01-06'), value: 81.5 },
    { date: new Date('2025-01-07'), value: 90 }, // Anomaly
  ];

  it('detects anomalies correctly', () => {
    const anomalies = AnomalyDetector.detectAnomalies(data);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].index).toBe(6);
    expect(anomalies[0].value).toBe(90);
  });
});
