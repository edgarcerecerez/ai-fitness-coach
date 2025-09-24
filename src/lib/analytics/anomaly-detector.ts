
import { MetricPoint } from './trend-detection';

export interface Anomaly {
  readonly index: number;
  readonly value: number;
  readonly severity: 'mild' | 'moderate' | 'severe';
}

export class AnomalyDetector {
  static detectAnomalies(data: MetricPoint[], stdDevThreshold: number = 2): Anomaly[] {
    if (data.length < 5) {
      return [];
    }

    const values = data.map(p => p.value);
    const n = values.length;
    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n);

    const anomalies: Anomaly[] = [];

    for (let i = 0; i < n; i++) {
      const deviation = Math.abs(values[i] - mean);

      if (deviation > stdDevThreshold * stdDev) {
        let severity: Anomaly['severity'] = 'mild';
        if (deviation > (stdDevThreshold + 1) * stdDev) {
          severity = 'moderate';
        }
        if (deviation > (stdDevThreshold + 2) * stdDev) {
          severity = 'severe';
        }

        anomalies.push({
          index: i,
          value: values[i],
          severity,
        });
      }
    }

    return anomalies;
  }
}
