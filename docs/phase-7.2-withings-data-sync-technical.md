# Phase 7.2: Withings Data Synchronization Engine

## Technical Implementation Summary

### Real-time Sync Architecture
This phase **does not use Supabase Realtime** or traditional websockets. Instead, it employs a **hybrid sync approach**:

1. **Scheduled Background Jobs**: Uses Inngest for scheduled sync jobs every 4 hours for connected users
2. **Manual Sync Triggers**: Users can manually trigger immediate sync via API endpoints that queue Inngest jobs
3. **Webhook Preparation**: Prepares the foundation for Phase 7.3's real-time webhooks from Withings (also using Inngest)

### Key Technical Components
- **Job Queue System**: Uses Inngest for background job processing with built-in retries and monitoring
- **Conflict Resolution**: Automated detection and resolution of overlapping manual vs. device measurements
- **Batch Processing**: Handles large historical datasets with pagination and rate limiting
- **Idempotent Operations**: Prevents duplicate data import through unique constraints and measurement ID tracking

### Data Flow
1. **Inngest Scheduled Job** → Checks users needing sync (last sync > 4 hours ago)
2. **API Client** → Fetches measurements from Withings with rate limiting (120 req/min)
3. **Data Processing** → Validates, transforms, and deduplicates measurement data
4. **Conflict Detection** → Compares with existing manual entries within time windows
5. **Database Storage** → Stores in `weight_logs` with Withings metadata and sync status

### Scalability Approach
- **Background Processing**: Inngest handles async job processing for multiple users concurrently
- **Database Optimization**: Indexes on sync status, measurement IDs, and timestamps
- **Error Handling**: Inngest provides built-in exponential backoff, retries, and error tracking

## Overview
This phase implements the core data synchronization engine for retrieving, processing, and storing measurement data from Withings devices. It includes historical data import, real-time syncing, conflict resolution, and data validation.

## Technical Architecture

### Component Structure
```
src/
├── lib/
│   ├── withings/
│   │   ├── sync-engine.ts       # Main sync orchestration
│   │   ├── measurements.ts      # Measurement data processing
│   │   ├── conflict-resolver.ts # Handle data conflicts
│   │   ├── data-mapper.ts       # Transform Withings data to app format
│   │   └── validation.ts        # Data validation utilities
│   └── inngest/
│       ├── withings-sync.ts     # Inngest sync functions
│       └── sync-scheduler.ts    # Inngest scheduled jobs
├── app/api/integrations/withings/
│   ├── sync/route.ts            # Manual sync trigger (queues Inngest jobs)
│   ├── sync-history/route.ts    # Sync job history
│   └── measurements/route.ts    # Get measurement data
└── components/
    └── settings/
        ├── withings-sync-status.tsx  # Sync status display
        └── sync-history.tsx          # Sync history view
```

## Database Schema Extensions

```sql
-- Sync job tracking (enhanced for Inngest integration)
CREATE TABLE withings_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES withings_connections(id) ON DELETE CASCADE,
  inngest_event_id VARCHAR, -- Inngest event ID for tracking
  job_type VARCHAR NOT NULL, -- 'manual', 'webhook', 'scheduled', 'historical'
  status VARCHAR NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  measurements_requested INTEGER DEFAULT 0,
  measurements_processed INTEGER DEFAULT 0,
  measurements_synced INTEGER DEFAULT 0,
  measurements_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  error_code VARCHAR,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3, -- Inngest handles retries, this is for tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for sync job queries
CREATE INDEX idx_withings_sync_jobs_connection_id ON withings_sync_jobs(connection_id);
CREATE INDEX idx_withings_sync_jobs_status ON withings_sync_jobs(status);
CREATE INDEX idx_withings_sync_jobs_created_at ON withings_sync_jobs(created_at);
CREATE INDEX idx_withings_sync_jobs_inngest_event ON withings_sync_jobs(inngest_event_id);

-- Sync job details for debugging
CREATE TABLE withings_sync_job_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id UUID NOT NULL REFERENCES withings_sync_jobs(id) ON DELETE CASCADE,
  measurement_id VARCHAR NOT NULL,
  measurement_type INTEGER NOT NULL,
  measurement_value DECIMAL NOT NULL,
  measurement_unit INTEGER NOT NULL,
  measurement_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  processing_status VARCHAR NOT NULL, -- 'processed', 'skipped', 'error'
  processing_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sync_job_details_sync_job_id ON withings_sync_job_details(sync_job_id);

-- Enhance weight_logs table for Withings integration
ALTER TABLE weight_logs ADD COLUMN withings_measurement_id BIGINT;
ALTER TABLE weight_logs ADD COLUMN withings_device_id VARCHAR;
ALTER TABLE weight_logs ADD COLUMN sync_status VARCHAR DEFAULT 'manual'; -- 'manual', 'synced', 'pending', 'conflict'
ALTER TABLE weight_logs ADD COLUMN measurement_quality INTEGER; -- Quality score from Withings
ALTER TABLE weight_logs ADD COLUMN body_fat_percentage DECIMAL(5,2);
ALTER TABLE weight_logs ADD COLUMN muscle_mass_kg DECIMAL(5,2);
ALTER TABLE weight_logs ADD COLUMN bone_mass_kg DECIMAL(5,2);
ALTER TABLE weight_logs ADD COLUMN water_percentage DECIMAL(5,2);

-- Indexes for efficient queries
CREATE INDEX idx_weight_logs_withings_measurement ON weight_logs(withings_measurement_id);
CREATE INDEX idx_weight_logs_sync_status ON weight_logs(sync_status);
CREATE UNIQUE INDEX idx_weight_logs_withings_unique ON weight_logs(user_id, withings_measurement_id) WHERE withings_measurement_id IS NOT NULL;

-- Conflict resolution tracking
CREATE TABLE withings_data_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  sync_job_id UUID REFERENCES withings_sync_jobs(id) ON DELETE SET NULL,
  conflict_type VARCHAR NOT NULL, -- 'duplicate_measurement', 'value_mismatch', 'timestamp_overlap'
  withings_measurement_id BIGINT NOT NULL,
  existing_weight_log_id UUID REFERENCES weight_logs(id) ON DELETE CASCADE,
  withings_data JSONB NOT NULL,
  existing_data JSONB NOT NULL,
  resolution_strategy VARCHAR, -- 'keep_existing', 'use_withings', 'manual_review', 'merge'
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by VARCHAR, -- 'system', 'user'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_withings_conflicts_user_id ON withings_data_conflicts(user_id);
CREATE INDEX idx_withings_conflicts_resolved ON withings_data_conflicts(resolved_at);

-- Device tracking
CREATE TABLE withings_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES withings_connections(id) ON DELETE CASCADE,
  device_id VARCHAR NOT NULL,
  device_model VARCHAR,
  device_type VARCHAR, -- 'scale', 'blood_pressure', 'thermometer'
  battery_level INTEGER,
  timezone VARCHAR,
  last_session_date TIMESTAMP WITH TIME ZONE,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(connection_id, device_id)
);

CREATE INDEX idx_withings_devices_connection_id ON withings_devices(connection_id);
```

## Implementation Details

### 1. Core Sync Engine

```typescript
// src/lib/withings/sync-engine.ts
import { WithingsApiClient } from './client';
import { WithingsConnectionService } from './database';
import { MeasurementProcessor } from './measurements';
import { ConflictResolver } from './conflict-resolver';
import { WithingsMeasurement, SyncJobOptions, SyncResult } from './types';

export class WithingsSyncEngine {
  private apiClient: WithingsApiClient;
  private connectionService: WithingsConnectionService;
  private measurementProcessor: MeasurementProcessor;
  private conflictResolver: ConflictResolver;

  constructor() {
    this.apiClient = new WithingsApiClient();
    this.connectionService = new WithingsConnectionService();
    this.measurementProcessor = new MeasurementProcessor();
    this.conflictResolver = new ConflictResolver();
  }

  /**
   * Start sync job for user (Inngest-compatible)
   */
  async startSync(userId: string, options: SyncJobOptions, inngestEventId?: string): Promise<string> {
    const connection = await this.connectionService.getConnection(userId);
    if (!connection) {
      throw new Error('No active Withings connection found');
    }

    // Create sync job record with Inngest event tracking
    const syncJob = await this.createSyncJob(connection.id, options, inngestEventId);
    
    // For Inngest, return job ID immediately - processing handled by Inngest function
    // For non-Inngest calls, process in background (backward compatibility)
    if (!inngestEventId) {
      this.processSyncJob(syncJob.id, userId, options).catch(error => {
        console.error(`Sync job ${syncJob.id} failed:`, error);
        this.updateSyncJobStatus(syncJob.id, 'failed', error.message);
      });
    }

    return syncJob.id;
  }

  /**
   * Process sync job
   */
  private async processSyncJob(
    syncJobId: string, 
    userId: string, 
    options: SyncJobOptions
  ): Promise<void> {
    await this.updateSyncJobStatus(syncJobId, 'processing');

    try {
      const measurements = await this.fetchMeasurements(userId, options);
      await this.updateSyncJobProgress(syncJobId, { measurements_requested: measurements.length });

      const results = await this.processMeasurements(syncJobId, userId, measurements);
      
      await this.updateSyncJobStatus(syncJobId, 'completed');
      await this.updateSyncJobProgress(syncJobId, {
        measurements_processed: results.processed,
        measurements_synced: results.synced,
        measurements_skipped: results.skipped
      });

      // Update connection last sync time
      await this.connectionService.updateLastSync(userId);
      
    } catch (error) {
      await this.updateSyncJobStatus(syncJobId, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Fetch measurements from Withings API
   */
  private async fetchMeasurements(
    userId: string, 
    options: SyncJobOptions
  ): Promise<WithingsMeasurement[]> {
    const params: any = {
      action: 'getmeas',
      meastypes: this.getMeasurementTypes(options.measurementTypes),
      category: 1 // Real measurements only
    };

    if (options.startDate) {
      params.startdate = Math.floor(options.startDate.getTime() / 1000);
    }
    if (options.endDate) {
      params.enddate = Math.floor(options.endDate.getTime() / 1000);
    }
    if (options.lastUpdate) {
      params.lastupdate = Math.floor(options.lastUpdate.getTime() / 1000);
    }

    const response = await this.apiClient.makeRequest(userId, '/measure', params);
    
    if (!response.body || !response.body.measuregrps) {
      return [];
    }

    return this.parseMeasurements(response.body.measuregrps);
  }

  /**
   * Parse Withings measurement groups into structured data
   */
  private parseMeasurements(measureGroups: any[]): WithingsMeasurement[] {
    const measurements: WithingsMeasurement[] = [];

    for (const group of measureGroups) {
      const timestamp = new Date(group.date * 1000);
      const deviceId = group.deviceid;
      const category = group.category;
      
      for (const measure of group.measures) {
        measurements.push({
          id: `${group.grpid}_${measure.type}`,
          groupId: group.grpid,
          type: measure.type,
          value: measure.value * Math.pow(10, measure.unit),
          unit: measure.unit,
          timestamp,
          deviceId,
          category,
          comment: group.comment
        });
      }
    }

    return measurements.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Process measurements and handle conflicts
   */
  private async processMeasurements(
    syncJobId: string,
    userId: string,
    measurements: WithingsMeasurement[]
  ): Promise<SyncResult> {
    let processed = 0;
    let synced = 0;
    let skipped = 0;

    for (const measurement of measurements) {
      try {
        // Check if measurement already exists
        const existing = await this.measurementProcessor.findExisting(
          userId, 
          measurement.id
        );

        if (existing) {
          await this.logSyncDetail(syncJobId, measurement, 'skipped', 'Already exists');
          skipped++;
          continue;
        }

        // Check for conflicts with manual entries
        const conflicts = await this.conflictResolver.checkForConflicts(
          userId, 
          measurement
        );

        if (conflicts.length > 0) {
          await this.handleConflicts(syncJobId, userId, measurement, conflicts);
          skipped++;
        } else {
          await this.measurementProcessor.saveMeasurement(userId, measurement);
          await this.logSyncDetail(syncJobId, measurement, 'processed', 'Successfully synced');
          synced++;
        }

        processed++;

      } catch (error) {
        console.error(`Failed to process measurement ${measurement.id}:`, error);
        await this.logSyncDetail(
          syncJobId, 
          measurement, 
          'error', 
          error.message
        );
        processed++;
      }
    }

    return { processed, synced, skipped };
  }

  /**
   * Get measurement types for API request
   */
  private getMeasurementTypes(types?: string[]): string {
    const defaultTypes = [1, 4, 5, 6, 8, 76, 77, 88]; // Weight, height, fat-free mass, fat ratio, fat mass, muscle mass, hydration, bone mass
    
    if (!types) {
      return defaultTypes.join(',');
    }

    const typeMap: Record<string, number> = {
      weight: 1,
      height: 4,
      fat_free_mass: 5,
      fat_ratio: 6,
      fat_mass: 8,
      muscle_mass: 76,
      hydration: 77,
      bone_mass: 88
    };

    return types
      .map(type => typeMap[type])
      .filter(Boolean)
      .join(',');
  }

  /**
   * Handle measurement conflicts
   */
  private async handleConflicts(
    syncJobId: string,
    userId: string,
    measurement: WithingsMeasurement,
    conflicts: any[]
  ): Promise<void> {
    for (const conflict of conflicts) {
      await this.conflictResolver.createConflict(
        userId,
        syncJobId,
        measurement,
        conflict
      );
    }
  }

  /**
   * Log detailed sync information
   */
  private async logSyncDetail(
    syncJobId: string,
    measurement: WithingsMeasurement,
    status: string,
    reason: string
  ): Promise<void> {
    const { supabase } = await import('@/utils/supabase/server');
    
    await supabase.from('withings_sync_job_details').insert({
      sync_job_id: syncJobId,
      measurement_id: measurement.id,
      measurement_type: measurement.type,
      measurement_value: measurement.value,
      measurement_unit: measurement.unit,
      measurement_timestamp: measurement.timestamp.toISOString(),
      processing_status: status,
      processing_reason: reason
    });
  }

  // Helper methods for database operations
  private async createSyncJob(connectionId: string, options: SyncJobOptions, inngestEventId?: string): Promise<any> {
    const { supabase } = await import('@/utils/supabase/server');
    
    const { data, error } = await supabase
      .from('withings_sync_jobs')
      .insert({
        connection_id: connectionId,
        inngest_event_id: inngestEventId,
        job_type: options.jobType || 'manual',
        start_date: options.startDate?.toISOString(),
        end_date: options.endDate?.toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Wait for sync completion (used by Inngest functions)
   */
  async waitForSyncCompletion(jobId: string, timeoutMs: number): Promise<SyncResult> {
    const { supabase } = await import('@/utils/supabase/server');
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const { data: job } = await supabase
        .from('withings_sync_jobs')
        .select('status, measurements_processed, measurements_synced, measurements_skipped, error_message')
        .eq('id', jobId)
        .single();

      if (!job) {
        throw new Error(`Sync job ${jobId} not found`);
      }

      if (job.status === 'completed') {
        return {
          processed: job.measurements_processed || 0,
          synced: job.measurements_synced || 0,
          skipped: job.measurements_skipped || 0
        };
      }

      if (job.status === 'failed') {
        throw new Error(`Sync job failed: ${job.error_message || 'Unknown error'}`);
      }

      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(`Sync job ${jobId} timeout after ${timeoutMs}ms`);
  }

  private async updateSyncJobStatus(
    syncJobId: string, 
    status: string, 
    errorMessage?: string
  ): Promise<void> {
    const { supabase } = await import('@/utils/supabase/server');
    
    const updateData: any = { 
      status, 
      updated_at: new Date().toISOString() 
    };

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    await supabase
      .from('withings_sync_jobs')
      .update(updateData)
      .eq('id', syncJobId);
  }

  private async updateSyncJobProgress(
    syncJobId: string, 
    progress: Partial<SyncResult>
  ): Promise<void> {
    const { supabase } = await import('@/utils/supabase/server');
    
    await supabase
      .from('withings_sync_jobs')
      .update({
        ...progress,
        updated_at: new Date().toISOString()
      })
      .eq('id', syncJobId);
  }
}
```

### 2. Measurement Data Processor

```typescript
// src/lib/withings/measurements.ts
import { WithingsMeasurement, ProcessedMeasurement } from './types';
import { WeightUnit } from '@/lib/weight-conversion';

export class MeasurementProcessor {
  /**
   * Find existing measurement by Withings ID
   */
  async findExisting(userId: string, measurementId: string): Promise<any> {
    const { supabase } = await import('@/utils/supabase/server');
    
    const { data } = await supabase
      .from('weight_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('withings_measurement_id', measurementId)
      .single();

    return data;
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

    const { supabase } = await import('@/utils/supabase/server');
    
    const { data, error } = await supabase
      .from('weight_logs')
      .insert({
        user_id: userId,
        weight_kg: processed.weight,
        weight_unit: WeightUnit.KG,
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

    return {
      valid: issues.length === 0,
      issues
    };
  }
}
```

### 3. Conflict Resolution System

```typescript
// src/lib/withings/conflict-resolver.ts
import { WithingsMeasurement, ConflictType } from './types';

export class ConflictResolver {
  /**
   * Check for conflicts with existing manual entries
   */
  async checkForConflicts(
    userId: string, 
    measurement: WithingsMeasurement
  ): Promise<any[]> {
    if (measurement.type !== 1) return []; // Only check weight conflicts for now

    const { supabase } = await import('@/utils/supabase/server');
    
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

    const conflicts = [];

    for (const entry of existingEntries || []) {
      const conflict = this.analyzeConflict(measurement, entry);
      if (conflict) {
        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * Analyze conflict between Withings measurement and existing entry
   */
  private analyzeConflict(
    measurement: WithingsMeasurement, 
    existingEntry: any
  ): any | null {
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
    conflict: any
  ): Promise<void> {
    const { supabase } = await import('@/utils/supabase/server');
    
    await supabase.from('withings_data_conflicts').insert({
      user_id: userId,
      sync_job_id: syncJobId,
      conflict_type: conflict.type,
      withings_measurement_id: measurement.id,
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
  }

  /**
   * Determine automatic resolution strategy
   */
  private getAutoResolutionStrategy(conflict: any): string {
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
  async getUnresolvedConflicts(userId: string): Promise<any[]> {
    const { supabase } = await import('@/utils/supabase/server');
    
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
    const { supabase } = await import('@/utils/supabase/server');
    
    await supabase
      .from('withings_data_conflicts')
      .update({
        resolution_strategy: resolution,
        resolved_at: new Date().toISOString(),
        resolved_by: 'user'
      })
      .eq('id', conflictId)
      .eq('user_id', userId);

    // Apply the resolution
    await this.applyResolution(conflictId, resolution);
  }

  /**
   * Apply conflict resolution
   */
  private async applyResolution(conflictId: string, resolution: string): Promise<void> {
    const { supabase } = await import('@/utils/supabase/server');
    
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
}
```

## API Routes

### 1. Manual Sync Trigger

```typescript
// src/app/api/integrations/withings/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { WithingsSyncEngine } from '@/lib/withings/sync-engine';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { startDate, endDate, measurementTypes } = body;

    const syncEngine = new WithingsSyncEngine();
    const jobId = await syncEngine.startSync(user.id, {
      jobType: 'manual',
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      measurementTypes
    });

    return NextResponse.json({ jobId, status: 'started' });
  } catch (error) {
    console.error('Manual sync failed:', error);
    return NextResponse.json(
      { error: 'Failed to start sync' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    const { data: job } = await supabase
      .from('withings_sync_jobs')
      .select(`
        *,
        connection:withings_connections!inner(user_id)
      `)
      .eq('id', jobId)
      .eq('connection.user_id', user.id)
      .single();

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: {
        requested: job.measurements_requested,
        processed: job.measurements_processed,
        synced: job.measurements_synced,
        skipped: job.measurements_skipped
      },
      error: job.error_message,
      createdAt: job.created_at,
      completedAt: job.completed_at
    });
  } catch (error) {
    console.error('Failed to get sync job status:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}
```

### 2. Sync History

```typescript
// src/app/api/integrations/withings/sync-history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const { data: jobs, error } = await supabase
      .from('withings_sync_jobs')
      .select(`
        *,
        connection:withings_connections!inner(user_id)
      `)
      .eq('connection.user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    const { data: totalCount } = await supabase
      .from('withings_sync_jobs')
      .select('count', { count: 'exact' })
      .eq('connection.user_id', user.id);

    return NextResponse.json({
      jobs: jobs.map(job => ({
        id: job.id,
        type: job.job_type,
        status: job.status,
        progress: {
          requested: job.measurements_requested,
          processed: job.measurements_processed,
          synced: job.measurements_synced,
          skipped: job.measurements_skipped
        },
        error: job.error_message,
        createdAt: job.created_at,
        completedAt: job.completed_at
      })),
      total: totalCount?.[0]?.count || 0,
      hasMore: offset + limit < (totalCount?.[0]?.count || 0)
    });
  } catch (error) {
    console.error('Failed to get sync history:', error);
    return NextResponse.json(
      { error: 'Failed to get sync history' },
      { status: 500 }
    );
  }
}
```

## Background Jobs

### 1. Inngest Scheduled Sync Functions

```typescript
// src/lib/inngest/withings-sync.ts
import { inngest } from '@/lib/inngest/client';
import { WithingsSyncEngine } from '@/lib/withings/sync-engine';

// Scheduled sync function - runs every 4 hours
export const scheduledWithingsSync = inngest.createFunction(
  { id: 'withings-scheduled-sync' },
  { cron: '0 */4 * * *' }, // Every 4 hours
  async ({ step }) => {
    const syncEngine = new WithingsSyncEngine();
    
    // Step 1: Get all active connections that need sync
    const connections = await step.run('get-connections-needing-sync', async () => {
      const { supabase } = await import('@/utils/supabase/server');
      
      const { data } = await supabase
        .from('withings_connections')
        .select('user_id, last_sync_at, id')
        .eq('is_active', true);
      
      if (!data) return [];
      
      // Filter connections that haven't synced in 4+ hours
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      return data.filter(conn => {
        const lastSync = conn.last_sync_at ? new Date(conn.last_sync_at) : null;
        return !lastSync || lastSync < fourHoursAgo;
      });
    });

    // Step 2: Process each connection that needs sync
    const results = await step.run('process-sync-jobs', async () => {
      const promises = connections.map(async (connection) => {
        try {
          const lastSync = connection.last_sync_at ? new Date(connection.last_sync_at) : null;
          const jobId = await syncEngine.startSync(connection.user_id, {
            jobType: 'scheduled',
            lastUpdate: lastSync || undefined
          });
          
          return { userId: connection.user_id, jobId, success: true };
        } catch (error) {
          console.error(`Scheduled sync failed for user ${connection.user_id}:`, error);
          return { userId: connection.user_id, error: error.message, success: false };
        }
      });

      return Promise.allSettled(promises);
    });

    return {
      processedConnections: connections.length,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason })
    };
  }
);

// Manual sync function - triggered by API endpoints
export const manualWithingsSync = inngest.createFunction(
  { id: 'withings-manual-sync' },
  { event: 'withings/sync.manual' },
  async ({ event, step }) => {
    const { userId, options } = event.data;
    const syncEngine = new WithingsSyncEngine();

    // Start the sync process
    const jobId = await step.run('start-manual-sync', async () => {
      return syncEngine.startSync(userId, {
        ...options,
        jobType: 'manual'
      });
    });

    // Wait for sync completion with timeout
    const result = await step.run('wait-for-completion', async () => {
      return syncEngine.waitForSyncCompletion(jobId, 300000); // 5 minute timeout
    });

    return {
      userId,
      jobId,
      result
    };
  }
);

// Historical data import function - for initial sync of large datasets  
export const historicalWithingsSync = inngest.createFunction(
  { id: 'withings-historical-sync' },
  { event: 'withings/sync.historical' },
  async ({ event, step }) => {
    const { userId, dateRange } = event.data;
    const syncEngine = new WithingsSyncEngine();

    // Process historical data in batches to avoid timeouts
    const jobId = await step.run('start-historical-sync', async () => {
      return syncEngine.startSync(userId, {
        jobType: 'historical',
        startDate: new Date(dateRange.startDate),
        endDate: new Date(dateRange.endDate),
        batchSize: 100 // Process in smaller batches
      });
    });

    return {
      userId,
      jobId,
      dateRange
    };
  }
);
```

### 2. Inngest Client Setup

```typescript
// src/lib/inngest/client.ts
import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'ai-fitness-coach',
  name: 'AI Fitness Coach',
});
```

### 3. API Route Integration

```typescript
// src/app/api/integrations/withings/sync/route.ts (updated)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { inngest } from '@/lib/inngest/client';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { startDate, endDate, measurementTypes } = body;

    // Queue manual sync job with Inngest
    const event = await inngest.send({
      name: 'withings/sync.manual',
      data: {
        userId: user.id,
        options: {
          startDate,
          endDate,
          measurementTypes
        }
      }
    });

    return NextResponse.json({ 
      eventId: event.ids[0], 
      status: 'queued',
      message: 'Sync job queued successfully' 
    });
  } catch (error) {
    console.error('Manual sync failed:', error);
    return NextResponse.json(
      { error: 'Failed to queue sync job' },
      { status: 500 }
    );
  }
}
```

### 4. Inngest Serve Endpoint

```typescript
// src/app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { 
  scheduledWithingsSync, 
  manualWithingsSync, 
  historicalWithingsSync 
} from '@/lib/inngest/withings-sync';

// Register all Withings sync functions with Inngest
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    scheduledWithingsSync,
    manualWithingsSync,
    historicalWithingsSync,
  ],
});
```

### 5. Environment Variables for Inngest

```bash
# .env.local additions for Inngest
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key

# Production
INNGEST_EVENT_KEY=your_production_inngest_event_key
INNGEST_SIGNING_KEY=your_production_inngest_signing_key
```

## Testing Strategy

### Unit Tests
```typescript
// src/lib/withings/__tests__/sync-engine.test.ts
import { WithingsSyncEngine } from '../sync-engine';
import { mockWithingsMeasurements, mockSyncOptions } from './fixtures';

describe('WithingsSyncEngine', () => {
  let syncEngine: WithingsSyncEngine;

  beforeEach(() => {
    syncEngine = new WithingsSyncEngine();
  });

  test('processes measurements correctly', async () => {
    const measurements = mockWithingsMeasurements();
    const result = await syncEngine.processMeasurements('job123', 'user456', measurements);
    
    expect(result.processed).toBeGreaterThan(0);
    expect(result.synced).toBeLessThanOrEqual(result.processed);
  });

  test('handles API rate limiting gracefully', async () => {
    // Mock rate limit exceeded scenario
    await expect(
      syncEngine.startSync('user123', mockSyncOptions())
    ).rejects.toThrow('Rate limit exceeded');
  });
});
```

### Integration Tests
```typescript
// src/lib/withings/__tests__/integration.test.ts
import { testDatabaseSetup, testDatabaseTeardown } from '../../../utils/test-helpers';

describe('Withings Integration - Data Sync', () => {
  beforeEach(async () => {
    await testDatabaseSetup();
  });

  afterEach(async () => {
    await testDatabaseTeardown();
  });

  test('complete sync workflow', async () => {
    // Test full sync process from API call to database storage
    // Including conflict resolution
  });
});
```

## Monitoring & Alerts

### Key Metrics
- Sync success rate per user and globally
- Measurement processing time
- Conflict resolution rates
- API response times and error rates
- Data quality scores

### Alert Conditions
- Sync failure rate >5% over 1 hour
- Processing time >30 seconds per measurement
- High conflict rate (>10% of measurements)
- API error rate >2% over 15 minutes

This data synchronization engine provides robust, scalable measurement processing with comprehensive conflict resolution and monitoring capabilities.