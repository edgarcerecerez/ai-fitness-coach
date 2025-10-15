import { WithingsMeasurement, ConflictType, DataConflict } from './types';
import { apiLogger } from '@/lib/logger';
import { createClient } from '@/utils/supabase/server';

interface WeightLogEntry {
  readonly id: string;
  readonly weight_kg: number;
  readonly logged_at: string;
  readonly source: string;
}

interface UnresolvedConflict {
  readonly id: string;
  readonly conflict_type: string;
  readonly resolved_at: string | null;
  readonly existing_weight_log: WeightLogEntry;
  readonly resolution_strategy: string | null;
}

export class ConflictResolver {
  /**
   * Check for conflicts with existing manual entries
   */
  async checkForConflicts(
    userId: string, 
    measurement: WithingsMeasurement
  ): Promise<DataConflict[]> {
    if (measurement.type !== 1) return []; // Only check weight conflicts for now

    const supabase = await createClient();
    
    // Look for manual entries within 1 hour of the measurement
    const timeWindow = 60 * 60 * 1000; // 1 hour in milliseconds
    const startTime = new Date(measurement.timestamp.getTime() - timeWindow);
    const endTime = new Date(measurement.timestamp.getTime() + timeWindow);

    const { data: existingEntries } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('sync_status', 'manual')
      .gte('logged_at', startTime.toISOString())
      .lte('logged_at', endTime.toISOString());

    const conflicts: DataConflict[] = [];

    for (const entry of existingEntries || []) {
      const conflict = this.analyzeConflict(measurement, entry);
      if (conflict) {
        conflicts.push(conflict);
      }
    }

    if (conflicts.length > 0) {
      apiLogger.info('Conflicts detected for Withings measurement', {
        userId,
        measurementId: measurement.id,
        conflictCount: conflicts.length
      });
    }

    return conflicts;
  }

  /**
   * Analyze conflict between Withings measurement and existing entry
   */
  private analyzeConflict(
    measurement: WithingsMeasurement, 
    existingEntry: WeightLogEntry
  ): DataConflict | null {
    const timeDiff = Math.abs(
      measurement.timestamp.getTime() - new Date(existingEntry.logged_at).getTime()
    );
    const weightDiff = Math.abs(measurement.value - existingEntry.weight_kg);

    // If measurements are very close in time and weight, likely the same measurement
    if (timeDiff < 5 * 60 * 1000 && weightDiff < 0.1) { // 5 minutes, 0.1kg
      return {
        type: ConflictType.DUPLICATE_MEASUREMENT,
        existingEntry,
        timeDiff,
        weightDiff,
        severity: 'low'
      };
    }

    // If there's a significant weight difference
    if (weightDiff > 2) { // 2kg difference
      return {
        type: ConflictType.VALUE_MISMATCH,
        existingEntry,
        timeDiff,
        weightDiff,
        severity: 'high'
      };
    }

    // If measurements overlap in time but have different values
    if (timeDiff < 30 * 60 * 1000 && weightDiff > 0.5) { // 30 minutes, 0.5kg
      return {
        type: ConflictType.TIMESTAMP_OVERLAP,
        existingEntry,
        timeDiff,
        weightDiff,
        severity: 'medium'
      };
    }

    return null;
  }

  /**
   * Create conflict record for resolution
   */
  async createConflict(
    userId: string,
    syncJobId: string,
    measurement: WithingsMeasurement,
    conflict: DataConflict
  ): Promise<void> {
    const supabase = await createClient();
    const measurementId = Number(measurement.id);

    if (!Number.isFinite(measurementId)) {
      throw new Error(`Invalid Withings measurement id: ${measurement.id}`);
    }

    const { error } = await supabase.from('withings_data_conflicts').insert({
      user_id: userId,
      sync_job_id: syncJobId,
      conflict_type: conflict.type,
      withings_measurement_id: measurementId,
      existing_weight_log_id: conflict.existingEntry.id,
      withings_data: {
        value: measurement.value,
        timestamp: measurement.timestamp,
        device_id: measurement.deviceId
      },
      existing_data: {
        weight_kg: conflict.existingEntry.weight_kg,
        logged_at: conflict.existingEntry.logged_at,
        source: conflict.existingEntry.source
      },
      resolution_strategy: this.getAutoResolutionStrategy(conflict)
    });

    if (error) {
      throw new Error(`Failed to create conflict record: ${error.message}`);
    }

    apiLogger.info('Conflict record created', {
      userId,
      syncJobId,
      measurementId: measurement.id,
      conflictType: conflict.type,
      severity: conflict.severity
    });
  }

  /**
   * Determine automatic resolution strategy
   */
  private getAutoResolutionStrategy(conflict: DataConflict): string {
    switch (conflict.type) {
      case ConflictType.DUPLICATE_MEASUREMENT:
        return 'keep_existing'; // Don't overwrite manual entries with duplicates
      
      case ConflictType.VALUE_MISMATCH:
        if (conflict.severity === 'high') {
          return 'manual_review'; // Require user decision for large differences
        }
        return 'use_withings'; // Trust device data for moderate differences
      
      case ConflictType.TIMESTAMP_OVERLAP:
        return 'merge'; // Try to merge data where possible
      
      default:
        return 'manual_review';
    }
  }

  /**
   * Get unresolved conflicts for user
   */
  async getUnresolvedConflicts(userId: string): Promise<UnresolvedConflict[]> {
    const supabase = await createClient();
    
    const { data } = await supabase
      .from('withings_data_conflicts')
      .select(`
        *,
        existing_weight_log:existing_weight_log_id(*)
      `)
      .eq('user_id', userId)
      .is('resolved_at', null)
      .order('created_at', { ascending: false });

    return data || [];
  }

  /**
   * Resolve conflict with user choice
   */
  async resolveConflict(
    conflictId: string,
    resolution: string,
    userId: string
  ): Promise<void> {
    const supabase = await createClient();
    
    // Update conflict record
    const { error } = await supabase
      .from('withings_data_conflicts')
      .update({
        resolution_strategy: resolution,
        resolved_at: new Date().toISOString(),
        resolved_by: 'user'
      })
      .eq('id', conflictId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to update conflict resolution: ${error.message}`);
    }

    // Apply the resolution
    await this.applyResolution(conflictId, resolution);

    apiLogger.info('Conflict resolved', {
      conflictId,
      resolution,
      userId
    });
  }

  /**
   * Apply conflict resolution
   */
  private async applyResolution(conflictId: string, resolution: string): Promise<void> {
    const supabase = await createClient();
    
    const { data: conflict } = await supabase
      .from('withings_data_conflicts')
      .select('*')
      .eq('id', conflictId)
      .single();

    if (!conflict) return;

    switch (resolution) {
      case 'use_withings':
        // Update existing entry with Withings data
        await supabase
          .from('weight_logs')
          .update({
            weight_kg: conflict.withings_data.value,
            logged_at: conflict.withings_data.timestamp,
            withings_measurement_id: conflict.withings_measurement_id,
            withings_device_id: conflict.withings_data.device_id,
            sync_status: 'synced',
            source: 'withings_sync'
          })
          .eq('id', conflict.existing_weight_log_id);
        break;

      case 'keep_existing':
        // Do nothing, keep the manual entry
        break;

      case 'merge':
        // Keep existing entry but add Withings metadata
        await supabase
          .from('weight_logs')
          .update({
            withings_measurement_id: conflict.withings_measurement_id,
            withings_device_id: conflict.withings_data.device_id,
            sync_status: 'synced'
          })
          .eq('id', conflict.existing_weight_log_id);
        break;
    }
  }

  /**
   * Auto-resolve conflicts based on strategy
   */
  async autoResolveConflicts(userId: string): Promise<number> {
    const conflicts = await this.getUnresolvedConflicts(userId);
    let resolvedCount = 0;

    for (const conflict of conflicts) {
      if (conflict.resolution_strategy && conflict.resolution_strategy !== 'manual_review') {
        try {
          await this.resolveConflict(conflict.id, conflict.resolution_strategy, userId);
          resolvedCount++;
        } catch (error: unknown) {
          apiLogger.error('Failed to auto-resolve conflict', {
            conflictId: conflict.id,
            userId,
            error
          });
        }
      }
    }

    if (resolvedCount > 0) {
      apiLogger.info('Auto-resolved conflicts', {
        userId,
        resolvedCount,
        totalConflicts: conflicts.length
      });
    }

    return resolvedCount;
  }

  /**
   * Get conflict statistics for user
   */
  async getConflictStats(userId: string): Promise<{
    total: number;
    resolved: number;
    pending: number;
    byType: Record<string, number>;
  }> {
    const supabase = await createClient();
    
    const { data: conflicts } = await supabase
      .from('withings_data_conflicts')
      .select('conflict_type, resolved_at')
      .eq('user_id', userId);

    if (!conflicts) {
      return { total: 0, resolved: 0, pending: 0, byType: {} };
    }

    const total = conflicts.length;
    const resolved = conflicts.filter(c => c.resolved_at).length;
    const pending = total - resolved;

    const byType = conflicts.reduce((acc, conflict) => {
      acc[conflict.conflict_type] = (acc[conflict.conflict_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, resolved, pending, byType };
  }
}
