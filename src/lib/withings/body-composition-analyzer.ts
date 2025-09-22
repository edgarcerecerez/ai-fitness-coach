import { createClient } from '@/utils/supabase/server';
import { apiLogger } from '@/lib/logger';
import {
  BodyCompositionData,
  HealthMetrics,
  BiometricProfile,
  HydrationAssessment
} from './types';
import { WithingsAIIntegrationService } from './ai-integration-service';

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

    const bodyFatMass = this.calculateBodyFatMass(data.weight_kg, bodyFatPercentage);
    const leanBodyMass = this.calculateLeanBodyMass(data.weight_kg, bodyFatPercentage);

    return {
      bmi: this.calculateBMI(data.weight_kg, profile.height_m),
      bodyFatMass,
      leanBodyMass,
      metabolicAge: this.estimateMetabolicAge(data, profile),
      visceralFatLevel: this.estimateVisceralFatLevel(data, profile),
      healthyWeightRange: this.calculateHealthyWeightRange(profile.height_m),
      targetBodyFatRange: this.getTargetBodyFatRange(profile.age, profile.gender),
      muscleFatRatio: this.calculateMuscleFatRatio(muscleMass, bodyFatMass),
      boneDensityIndicator: this.calculateBoneDensityIndicator(boneMass, data.weight_kg),
      hydrationStatus: this.assessHydrationStatus(waterPercentage, profile),
      weightKg: Math.round(data.weight_kg * 10) / 10,
      bodyFatPercentage: bodyFatPercentage || null,
      muscleMassKg: muscleMass
    };
  }

  private calculateBMI(weightKg: number, heightM: number): HealthMetrics['bmi'] {
    if (!heightM || heightM <= 0) {
      return { value: 0, category: 'Unknown', health_risk: 'Unknown' };
    }

    const bmi = weightKg / (heightM * heightM);
    const rounded = Math.round(bmi * 10) / 10;

    if (bmi < 16) {
      return { value: rounded, category: 'Severely Underweight', health_risk: 'High' };
    }
    if (bmi < 18.5) {
      return { value: rounded, category: 'Underweight', health_risk: 'Moderate' };
    }
    if (bmi < 25) {
      return { value: rounded, category: 'Normal', health_risk: 'Low' };
    }
    if (bmi < 30) {
      return { value: rounded, category: 'Overweight', health_risk: 'Moderate' };
    }
    if (bmi < 35) {
      return { value: rounded, category: 'Obese Class I', health_risk: 'High' };
    }
    if (bmi < 40) {
      return { value: rounded, category: 'Obese Class II', health_risk: 'Very High' };
    }

    return { value: rounded, category: 'Obese Class III', health_risk: 'Extremely High' };
  }

  private calculateBodyFatMass(weightKg: number, bodyFatPercentage: number): number | null {
    if (!bodyFatPercentage) {
      return null;
    }
    return Math.round(((weightKg * bodyFatPercentage) / 100) * 100) / 100;
  }

  private calculateLeanBodyMass(weightKg: number, bodyFatPercentage: number): number | null {
    if (!bodyFatPercentage) {
      return null;
    }
    return Math.round((weightKg - (weightKg * bodyFatPercentage) / 100) * 100) / 100;
  }

  private estimateMetabolicAge(data: BodyCompositionData, profile: BiometricProfile): number | null {
    if (!profile.age || !profile.gender) {
      return null;
    }

    const bmr = this.calculateBMR(data, profile);
    const averageBmr = this.getAverageBMRForAge(profile.age, profile.gender);
    const adjustment = (bmr - averageBmr) / 10;
    const estimate = profile.age - adjustment;

    return Math.max(15, Math.min(80, Math.round(estimate)));
  }

  private calculateBMR(data: BodyCompositionData, profile: BiometricProfile): number {
    if (data.body_fat_percentage && data.body_fat_percentage > 0) {
      const leanBodyMass = data.weight_kg * (1 - data.body_fat_percentage / 100);
      return 370 + 21.6 * leanBodyMass;
    }

    const heightCm = profile.height_m * 100;
    if (profile.gender === 'male') {
      return 10 * data.weight_kg + 6.25 * heightCm - 5 * profile.age + 5;
    }
    return 10 * data.weight_kg + 6.25 * heightCm - 5 * profile.age - 161;
  }

  private estimateVisceralFatLevel(
    data: BodyCompositionData,
    profile: BiometricProfile
  ): number | null {
    if (!data.body_fat_percentage) {
      return null;
    }

    const base = data.body_fat_percentage / 2;
    const ageFactor = Math.max(0, profile.age - 35) / 5;
    return Math.round(Math.min(20, base + ageFactor));
  }

  private calculateHealthyWeightRange(heightM: number): { min: number; max: number } {
    const min = 18.5 * heightM * heightM;
    const max = 24.9 * heightM * heightM;
    return {
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10
    };
  }

  private getTargetBodyFatRange(age: number, gender: BiometricProfile['gender']): {
    min: number;
    max: number;
  } {
    if (gender === 'male') {
      if (age < 30) return { min: 8, max: 19 };
      if (age < 50) return { min: 11, max: 22 };
      return { min: 13, max: 25 };
    }

    if (age < 30) return { min: 16, max: 24 };
    if (age < 50) return { min: 19, max: 27 };
    return { min: 22, max: 30 };
  }

  private calculateMuscleFatRatio(
    muscleMass: number | null,
    fatMass: number | null
  ): number | null {
    if (!muscleMass || !fatMass || fatMass === 0) {
      return null;
    }
    return Math.round((muscleMass / fatMass) * 100) / 100;
  }

  private calculateBoneDensityIndicator(
    boneMass: number | null,
    totalWeight: number
  ): number | null {
    if (!boneMass || !totalWeight) {
      return null;
    }
    return Math.round(((boneMass / totalWeight) * 100) * 10) / 10;
  }

  private assessHydrationStatus(
    waterPercentage: number | null,
    profile: BiometricProfile
  ): HydrationAssessment | null {
    if (waterPercentage == null) {
      return null;
    }

    const range = this.getOptimalHydrationRange(profile.age, profile.gender);
    let level: HydrationAssessment['level'] = 'Adequate';
    let recommendation: string | undefined;

    if (waterPercentage < range.min - 3) {
      level = 'Dehydrated';
      recommendation = 'Increase water intake and monitor hydration closely.';
    } else if (waterPercentage < range.min) {
      level = 'Adequate';
      recommendation = 'Slightly increase daily hydration.';
    } else if (waterPercentage <= range.max) {
      level = 'Optimal';
      recommendation = 'Maintain your current hydration habits.';
    } else {
      level = 'Adequate';
      recommendation = 'Ensure electrolyte balance and monitor water intake.';
    }

    return {
      level,
      value: Math.round(waterPercentage * 10) / 10,
      recommendedRange: range,
      recommendation
    };
  }

  private getOptimalHydrationRange(age: number, gender: BiometricProfile['gender']): {
    min: number;
    max: number;
  } {
    if (gender === 'male') {
      if (age < 30) return { min: 59, max: 63 };
      if (age < 50) return { min: 56, max: 60 };
      return { min: 54, max: 58 };
    }

    if (age < 30) return { min: 52, max: 56 };
    if (age < 50) return { min: 49, max: 53 };
    return { min: 47, max: 51 };
  }

  private getAverageBMRForAge(age: number, gender: BiometricProfile['gender']): number {
    const base = gender === 'male' ? 1800 : 1400;
    const adjustment = Math.max(0, 30 - age) * 10;
    return base + adjustment;
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
