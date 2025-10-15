
import {
  BiometricProfile,
  BodyCompositionData,
  HealthMetrics,
  HydrationAssessment,
} from '@/lib/withings/types';

export class HealthMetricsCalculator {
  static calculateBMI(weightKg: number, heightM: number): HealthMetrics['bmi'] {
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

  static calculateBodyFatMass(weightKg: number, bodyFatPercentage: number): number | null {
    if (bodyFatPercentage == null) {
      return null;
    }
    return Math.round(((weightKg * bodyFatPercentage) / 100) * 100) / 100;
  }

  static calculateLeanBodyMass(weightKg: number, bodyFatPercentage: number): number | null {
    if (bodyFatPercentage == null) {
      return null;
    }
    return Math.round((weightKg - (weightKg * bodyFatPercentage) / 100) * 100) / 100;
  }

  static estimateMetabolicAge(data: BodyCompositionData, profile: BiometricProfile): number | null {
    if (!profile.age || !profile.gender) {
      return null;
    }

    const bmr = this.calculateBMR(data, profile);
    const averageBmr = this.getAverageBMRForAge(profile.age, profile.gender);
    const adjustment = (bmr - averageBmr) / 10;
    const estimate = profile.age - adjustment;

    return Math.max(15, Math.min(80, Math.round(estimate)));
  }

  static calculateBMR(data: BodyCompositionData, profile: BiometricProfile): number {
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

  static estimateVisceralFatLevel(
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

  static calculateHealthyWeightRange(heightM: number): { min: number; max: number } {
    const min = 18.5 * heightM * heightM;
    const max = 24.9 * heightM * heightM;
    return {
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10
    };
  }

  static getTargetBodyFatRange(age: number, gender: BiometricProfile['gender']): {
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

  static calculateMuscleFatRatio(
    muscleMass: number | null,
    fatMass: number | null
  ): number | null {
    if (!muscleMass || !fatMass || fatMass === 0) {
      return null;
    }
    return Math.round((muscleMass / fatMass) * 100) / 100;
  }

  static calculateBoneDensityIndicator(
    boneMass: number | null,
    totalWeight: number
  ): number | null {
    if (!boneMass || !totalWeight) {
      return null;
    }
    return Math.round(((boneMass / totalWeight) * 100) * 10) / 10;
  }

  static assessHydrationStatus(
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

  static getOptimalHydrationRange(age: number, gender: BiometricProfile['gender']): {
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

  static getAverageBMRForAge(age: number, gender: BiometricProfile['gender']): number {
    const base = gender === 'male' ? 1800 : 1400;
    const adjustment = Math.max(0, 30 - age) * 10;
    return base + adjustment;
  }
}
