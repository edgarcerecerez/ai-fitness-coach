jest.mock('../ai-integration-service', () => ({
  WithingsAIIntegrationService: jest.fn().mockImplementation(() => ({
    generateBodyCompositionInsights: jest.fn().mockResolvedValue([])
  }))
}));

import { BodyCompositionAnalyzer } from '../body-composition-analyzer';

describe('BodyCompositionAnalyzer', () => {
  const baseProfile = {
    age: 32,
    gender: 'female',
    height_m: 1.68,
    activity_level: 'moderately_active'
  };

  const createRawData = (weightKg, overrides = {}) => ({
    weight_kg: weightKg,
    body_fat_percentage: overrides.body_fat_percentage ?? 22,
    muscle_mass_kg: overrides.muscle_mass_kg ?? 28,
    bone_mass_kg: overrides.bone_mass_kg ?? 2.9,
    water_percentage: overrides.water_percentage ?? 55,
    measurement_quality_score: 92,
    data_completeness_score: 80
  });

  const buildAnalyzer = () => {
    const instance = new BodyCompositionAnalyzer();
    Reflect.set(instance, 'getUserProfile', jest.fn().mockResolvedValue(baseProfile));
    Reflect.set(instance, 'storeAnalysis', jest.fn().mockResolvedValue(undefined));
    return instance;
  };

  test('categorises BMI ranges through analyzeComposition', async () => {
    const analyzer = buildAnalyzer();

    const underweight = await analyzer.analyzeComposition('user-1', 'log-1', createRawData(45));
    const normal = await analyzer.analyzeComposition('user-1', 'log-2', createRawData(68));
    const obese = await analyzer.analyzeComposition('user-1', 'log-3', createRawData(140));

    expect(underweight.bmi.category).toBe('Severely Underweight');
    expect(normal.bmi.category).toBe('Normal');
    expect(obese.bmi.category).toBe('Obese Class III');
  });

  test('returns hydration assessment from analyzeComposition', async () => {
    const analyzer = buildAnalyzer();
    const metrics = await analyzer.analyzeComposition('user-1', 'log-4', createRawData(70, {
      water_percentage: 50
    }));

    expect(metrics.hydrationStatus?.value).toBeCloseTo(50);
    expect(metrics.hydrationStatus?.recommendedRange?.min).toBeGreaterThan(0);
  });

  test('derives quality scores when metrics are missing', async () => {
    const analyzer = buildAnalyzer();
    const metrics = await analyzer.analyzeComposition('user-1', 'log-5', {
      weight_kg: 75,
      body_fat_percentage: null,
      muscle_mass_kg: null,
      bone_mass_kg: null,
      water_percentage: null
    });

    expect(metrics.weightKg).toBe(75);
    expect(metrics.bodyFatMass).toBeNull();
  });
});
