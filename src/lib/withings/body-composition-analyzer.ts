import { createClient } from '@/utils/supabase/server';
import { apiLogger } from '@/lib/logger';
import {
  BodyCompositionData,
  HealthMetrics,
  BiometricProfile,
} from './types';
import { WithingsAIIntegrationService } from './ai-integration-service';
import { HealthMetricsCalculator } from '@/lib/analytics/health-metrics-calculator';

export class BodyCompositionAnalyzer {
  async analyzeComposition(
    userId: string,
    weightLogId: string,
    rawData: BodyCompositionData
  ): Promise<HealthMetrics> {
    const profile = await this.getUserProfile(userId);
    const metrics = this.calculateHealthMetrics(rawData, profile);
    const { measurementQuality, completenessScore } = this.resolveQualityScores(rawData);

    await this.storeAnalysis(
      userId,
      weightLogId,
      rawData,
      metrics,
      measurementQuality,
      completenessScore
    );

    try {
      const aiService = new WithingsAIIntegrationService();
      await aiService.generateBodyCompositionInsights(userId, metrics, profile);
    } catch (error) {
      apiLogger.error('Failed to generate Withings AI insights', {
        userId,
        weightLogId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return metrics;
  }

  private calculateHealthMetrics(
    data: BodyCompositionData,
    profile: BiometricProfile
  ): HealthMetrics {
    const bodyFatPercentage = Math.max(0, Number(data.body_fat_percentage ?? 0));
    const muscleMass = data.muscle_mass_kg != null ? Math.max(0, Number(data.muscle_mass_kg)) : null;
    const boneMass = data.bone_mass_kg != null ? Math.max(0, Number(data.bone_mass_kg)) : null;
    const waterPercentage = data.water_percentage != null ? Math.max(0, Number(data.water_percentage)) : null;

    const bodyFatMass = HealthMetricsCalculator.calculateBodyFatMass(data.weight_kg, bodyFatPercentage);
    const leanBodyMass = HealthMetricsCalculator.calculateLeanBodyMass(data.weight_kg, bodyFatPercentage);

    return {
      bmi: HealthMetricsCalculator.calculateBMI(data.weight_kg, profile.height_m),
      bodyFatMass,
      leanBodyMass,
      metabolicAge: HealthMetricsCalculator.estimateMetabolicAge(data, profile),
      visceralFatLevel: HealthMetricsCalculator.estimateVisceralFatLevel(data, profile),
      healthyWeightRange: HealthMetricsCalculator.calculateHealthyWeightRange(profile.height_m),
      targetBodyFatRange: HealthMetricsCalculator.getTargetBodyFatRange(profile.age, profile.gender),
      muscleFatRatio: HealthMetricsCalculator.calculateMuscleFatRatio(muscleMass, bodyFatMass),
      boneDensityIndicator: HealthMetricsCalculator.calculateBoneDensityIndicator(boneMass, data.weight_kg),
      hydrationStatus: HealthMetricsCalculator.assessHydrationStatus(waterPercentage, profile),
      weightKg: Math.round(data.weight_kg * 10) / 10,
      bodyFatPercentage: bodyFatPercentage || null,
      muscleMassKg: muscleMass
    };
  }

  private resolveQualityScores(data: BodyCompositionData): {
    measurementQuality: number;
    completenessScore: number;
  } {
    const measurementQuality = this.clampScore(
      data.measurement_quality_score ?? 80
    );

    const optionalMetrics = [
      data.body_fat_percentage,
      data.muscle_mass_kg,
      data.bone_mass_kg,
      data.water_percentage
    ];

    const presentCount = optionalMetrics.filter(value => value != null).length;
    const completenessScore = data.data_completeness_score ?? Math.round((presentCount / optionalMetrics.length) * 100);

    return {
      measurementQuality,
      completenessScore: this.clampScore(completenessScore)
    };
  }

  private clampScore(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private async storeAnalysis(
    userId: string,
    weightLogId: string,
    rawData: BodyCompositionData,
    metrics: HealthMetrics,
    measurementQuality: number,
    completenessScore: number
  ): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('withings_body_composition_analysis')
      .upsert({
        user_id: userId,
        weight_log_id: weightLogId,
        analysis_date: new Date().toISOString(),
        weight_kg: rawData.weight_kg,
        body_fat_percentage: rawData.body_fat_percentage,
        muscle_mass_kg: rawData.muscle_mass_kg,
        bone_mass_kg: rawData.bone_mass_kg,
        water_percentage: rawData.water_percentage,
        bmi: metrics.bmi.value,
        body_fat_mass_kg: metrics.bodyFatMass,
        lean_body_mass_kg: metrics.leanBodyMass,
        metabolic_age: metrics.metabolicAge,
        visceral_fat_level: metrics.visceralFatLevel,
        healthy_weight_range_min: metrics.healthyWeightRange.min,
        healthy_weight_range_max: metrics.healthyWeightRange.max,
        target_body_fat_min: metrics.targetBodyFatRange.min,
        target_body_fat_max: metrics.targetBodyFatRange.max,
        measurement_quality_score: measurementQuality,
        data_completeness_score: completenessScore
      }, { onConflict: 'weight_log_id' });

    if (error) {
      throw new Error(`Failed to store body composition analysis: ${error.message}`);
    }
  }

  private async getUserProfile(userId: string): Promise<BiometricProfile> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('user_profiles')
      .select('age, gender, height_cm, activity_level')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new Error(`User profile incomplete for ${userId}`);
    }

    if (data.height_cm == null || data.age == null || !data.gender) {
      throw new Error(`User profile missing required metrics for ${userId}`);
    }

    return {
      age: Number(data.age),
      gender: data.gender,
      height_m: Number(data.height_cm) / 100,
      activity_level: data.activity_level
    };
  }
}
