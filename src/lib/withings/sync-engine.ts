import { WithingsApiClient } from './client';
import { WithingsConnectionService } from './database';
import { MeasurementProcessor } from './measurements';
import { ConflictResolver } from './conflict-resolver';
import { 
  WithingsMeasurement, 
  SyncJobOptions, 
  SyncResult,
  WithingsSyncJobRecord,
  WithingsMeasureGroup,
  DataConflict
} from './types';
import { apiLogger } from '@/lib/logger';
import { createClient } from '@/utils/supabase/server';

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
        apiLogger.error('Sync job processing failed', { 
          syncJobId: syncJob.id,
          userId,
          error: error instanceof Error ? error.message : String(error)
        });
        this.updateSyncJobStatus(syncJob.id, 'failed', error instanceof Error ? error.message : String(error));
      });
    }

    return syncJob.id;
  }

  /**
   * Process sync job
   */
  async processSyncJob(
    syncJobId: string, 
    userId: string, 
    options: SyncJobOptions
  ): Promise<SyncResult> {
    await this.updateSyncJobStatus(syncJobId, 'processing');

    try {
      const measurements = await this.fetchMeasurements(userId, options);
      await this.updateSyncJobProgress(syncJobId, { measurements_requested: measurements.length });

      const results = await this.processMeasurements(syncJobId, userId, measurements);
      
      await this.updateSyncJobStatus(syncJobId, 'completed');
      await this.updateSyncJobProgress(syncJobId, {
        measurements_processed: results.measurements_processed,
        measurements_synced: results.measurements_synced,
        measurements_skipped: results.measurements_skipped
      });

      // Update connection last sync time
      await this.connectionService.updateLastSync(userId);
      
      apiLogger.info('Sync job completed successfully', {
        syncJobId,
        userId,
        results
      });

      return results;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateSyncJobStatus(syncJobId, 'failed', errorMessage);
      
      apiLogger.error('Sync job failed', {
        syncJobId,
        userId,
        error: errorMessage
      });
      
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
    const params: Record<string, string | number> = {
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

    const response = await this.apiClient.makeRequest<{ measuregrps?: WithingsMeasureGroup[] }>(
      userId,
      '/measure',
      params
    );

    const measureGroups = response.body?.measuregrps;
    if (!Array.isArray(measureGroups) || measureGroups.length === 0) {
      return [];
    }

    return this.parseMeasurements(measureGroups);
  }

  /**
   * Parse Withings measurement groups into structured data
   */
  private parseMeasurements(measureGroups: WithingsMeasureGroup[]): WithingsMeasurement[] {
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
        apiLogger.error('Failed to process measurement', {
          syncJobId,
          measurementId: measurement.id,
          error: error instanceof Error ? error.message : String(error)
        });
        
        await this.logSyncDetail(
          syncJobId, 
          measurement, 
          'error', 
          error instanceof Error ? error.message : String(error)
        );
        processed++;
      }
    }

    return { measurements_processed: processed, measurements_synced: synced, measurements_skipped: skipped };
  }

  /**
   * Get measurement types for API request
   */
  private getMeasurementTypes(types?: readonly string[]): string {
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
    conflicts: DataConflict[]
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
    const supabase = await createClient();
    
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

  /**
   * Wait for sync completion (used by Inngest functions)
   */
  async waitForSyncCompletion(jobId: string, timeoutMs: number): Promise<SyncResult> {
    const supabase = await createClient();
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
          measurements_processed: job.measurements_processed || 0,
          measurements_synced: job.measurements_synced || 0,
          measurements_skipped: job.measurements_skipped || 0
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

  // Helper methods for database operations
  private async createSyncJob(connectionId: string, options: SyncJobOptions, inngestEventId?: string): Promise<WithingsSyncJobRecord> {
    const supabase = await createClient();
    
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

  private async updateSyncJobStatus(
    syncJobId: string, 
    status: string, 
    errorMessage?: string
  ): Promise<void> {
    const supabase = await createClient();
    
    const updateData: { status: string; updated_at: string; completed_at?: string; error_message?: string } = { 
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
    progress: Partial<SyncResult & { measurements_requested: number }>
  ): Promise<void> {
    const supabase = await createClient();
    
    await supabase
      .from('withings_sync_jobs')
      .update({
        ...progress,
        updated_at: new Date().toISOString()
      })
      .eq('id', syncJobId);
  }
}
