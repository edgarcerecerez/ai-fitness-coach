
import { HealthMetricsCalculator } from './health-metrics-calculator';
import { BiometricProfile, BodyCompositionData } from '@/lib/withings/types';

describe('HealthMetricsCalculator', () => {
  const profile: BiometricProfile = {
    age: 30,
    gender: 'male',
    height_m: 1.8,
    activity_level: 'active',
  };

  const data: BodyCompositionData = {
    weight_kg: 80,
    body_fat_percentage: 20,
    muscle_mass_kg: 60,
    bone_mass_kg: 4,
    water_percentage: 55,
  };

  it('calculates BMI correctly', () => {
    const bmi = HealthMetricsCalculator.calculateBMI(80, 1.8);
    expect(bmi.value).toBeCloseTo(24.7);
    expect(bmi.category).toBe('Normal');
  });

  it('calculates body fat mass correctly', () => {
    const bodyFatMass = HealthMetricsCalculator.calculateBodyFatMass(80, 20);
    expect(bodyFatMass).toBe(16);
  });

  it('calculates lean body mass correctly', () => {
    const leanBodyMass = HealthMetricsCalculator.calculateLeanBodyMass(80, 20);
    expect(leanBodyMass).toBe(64);
  });

  it('estimates metabolic age correctly', () => {
    const metabolicAge = HealthMetricsCalculator.estimateMetabolicAge(data, profile);
    expect(metabolicAge).toBeGreaterThan(15);
    expect(metabolicAge).toBeLessThan(80);
  });
});
