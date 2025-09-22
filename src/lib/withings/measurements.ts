import { WithingsMeasurement, ProcessedMeasurement } from './types';
import { apiLogger } from '@/lib/logger';
import { createClient } from '@/utils/supabase/server';

interface WeightLogEntry {
  readonly id: string;
}

interface WeightLogMeasurement {
  readonly id: string;
  readonly weight_kg: number;
  readonly logged_at: string;
  readonly withings_measurement_id: string | null;
  readonly withings_device_id: string | null;
  readonly sync_status: string;
  readonly body_fat_percentage: number | null;
  readonly muscle_mass_kg: number | null;
  readonly bone_mass_kg: number | null;
  readonly water_percentage: number | null;
}

export class MeasurementProcessor {
  /**
   * Find existing measurement by Withings ID
   */
  async findExisting(userId: string, measurementId: string): Promise<WeightLogEntry | null> {
    const supabase = await createClient();
    
    const { data } = await supabase
      .from('weight_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('withings_measurement_id', measurementId)
      .single();

    return data || null;
  }

  /**
   * Save measurement to database
   */
  async saveMeasurement(
    userId: string, 
    measurement: WithingsMeasurement
  ): Promise<string> {
    const processed = this.processRawMeasurement(measurement);
    
    if (!processed.weight) {
      throw new Error('No weight data in measurement');
    }

    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('weight_logs')
      .insert({
        user_id: userId,
        weight_kg: processed.weight,
        weight_unit: 'kg',
        logged_at: measurement.timestamp.toISOString(),
        withings_measurement_id: measurement.id,
        withings_device_id: measurement.deviceId,
        sync_status: 'synced',
        body_fat_percentage: processed.bodyFat,
        muscle_mass_kg: processed.muscleMass,
        bone_mass_kg: processed.boneMass,
        water_percentage: processed.hydration,
        source: 'withings_sync'
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to save measurement: ${error.message}`);
    }

    apiLogger.info('Withings measurement saved', {
      userId,
      measurementId: measurement.id,
      weightLogId: data.id,
      weight: processed.weight
    });

    return data.id;
  }

  /**
   * Process raw Withings measurement into app format
   */
  private processRawMeasurement(measurement: WithingsMeasurement): ProcessedMeasurement {
    const processed: ProcessedMeasurement = {};

    switch (measurement.type) {
      case 1: // Weight
        processed.weight = measurement.value;
        break;
      case 4: // Height
        processed.height = measurement.value;
        break;
      case 5: // Fat-free mass
        processed.fatFreeMass = measurement.value;
        break;
      case 6: // Fat ratio
        processed.bodyFat = measurement.value;
        break;
      case 8: // Fat mass weight
        processed.fatMass = measurement.value;
        break;
      case 76: // Muscle mass
        processed.muscleMass = measurement.value;
        break;
      case 77: // Hydration
        processed.hydration = measurement.value;
        break;
      case 88: // Bone mass
        processed.boneMass = measurement.value;
        break;
      default:
        apiLogger.warn('Unknown measurement type', {
          type: measurement.type,
          value: measurement.value
        });
        break;
    }

    return processed;
  }

  /**
   * Group measurements by timestamp for body composition
   */
  groupMeasurementsBySession(measurements: WithingsMeasurement[]): Map<string, WithingsMeasurement[]> {
    const sessions = new Map<string, WithingsMeasurement[]>();

    for (const measurement of measurements) {
      const sessionKey = `${measurement.groupId}_${measurement.timestamp.getTime()}`;
      
      if (!sessions.has(sessionKey)) {
        sessions.set(sessionKey, []);
      }
      
      sessions.get(sessionKey)!.push(measurement);
    }

    return sessions;
  }

  /**
   * Validate measurement data quality
   */
  validateMeasurement(measurement: WithingsMeasurement): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for reasonable weight values (20kg - 300kg)
    if (measurement.type === 1) {
      if (measurement.value < 20 || measurement.value > 300) {
        issues.push('Weight value outside reasonable range');
      }
    }

    // Check for future timestamps
    if (measurement.timestamp > new Date()) {
      issues.push('Measurement timestamp is in the future');
    }

    // Check for very old timestamps (more than 10 years ago)
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    if (measurement.timestamp < tenYearsAgo) {
      issues.push('Measurement timestamp is very old');
    }

    // Check for body fat percentage ranges (5% - 50%)
    if (measurement.type === 6) {
      if (measurement.value < 5 || measurement.value > 50) {
        issues.push('Body fat percentage outside reasonable range');
      }
    }

    // Check for hydration percentage ranges (40% - 70%)
    if (measurement.type === 77) {
      if (measurement.value < 40 || measurement.value > 70) {
        issues.push('Hydration percentage outside reasonable range');
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Calculate measurement quality score
   */
  calculateQualityScore(measurement: WithingsMeasurement): number {
    let score = 100;

    const validation = this.validateMeasurement(measurement);
    if (!validation.valid) {
      score -= validation.issues.length * 20;
    }

    // Penalize missing device ID
    if (!measurement.deviceId) {
      score -= 10;
    }

    // Penalize measurements without category
    if (!measurement.category) {
      score -= 5;
    }

    return Math.max(0, score);
  }

  /**
   * Get measurements for user within date range
   */
  async getMeasurementsInRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<WeightLogMeasurement[]> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('weight_logs')
      .select(`
        id,
        weight_kg,
        logged_at,
        withings_measurement_id,
        withings_device_id,
        sync_status,
        body_fat_percentage,
        muscle_mass_kg,
        bone_mass_kg,
        water_percentage
      `)
      .eq('user_id', userId)
      .gte('logged_at', startDate.toISOString())
      .lte('logged_at', endDate.toISOString())
      .eq('sync_status', 'synced')
      .order('logged_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get measurements: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update measurement sync status
   */
  async updateSyncStatus(
    measurementId: string,
    status: 'manual' | 'synced' | 'pending' | 'conflict'
  ): Promise<void> {
    const supabase = await createClient();
    
    try {
      const { error } = await supabase
        .from('weight_logs')
        .update({ sync_status: status })
        .eq('withings_measurement_id', measurementId);

      if (error) {
        throw error;
      }
    } catch (err) {
      apiLogger.error('Database update failed', {
        measurementId,
        status,
        error: err
      });
      if (err instanceof Error) {
        throw new Error(`Failed to update sync status: ${err.message}`);
      }
      throw new Error(`Failed to update sync status: ${String(err)}`);
    }
  }
}
