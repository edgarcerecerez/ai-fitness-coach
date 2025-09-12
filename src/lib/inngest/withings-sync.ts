import { getInngestClient } from '@/lib/inngest/client';
import { WithingsSyncEngine } from '@/lib/withings/sync-engine';
import { apiLogger } from '@/lib/logger';

// Get the Inngest client
const inngest = getInngestClient();

const processSingleConnection = async (
  connection: { user_id: string; last_sync_at: string | null; id: string },
  syncEngine: WithingsSyncEngine
) => {
  try {
    const lastSync = connection.last_sync_at ? new Date(connection.last_sync_at) : null;
    const jobId = await syncEngine.startSync(connection.user_id, {
      jobType: 'scheduled',
      lastUpdate: lastSync || undefined
    });
    
    return { userId: connection.user_id, jobId, success: true };
  } catch (error: unknown) {
    apiLogger.error('Scheduled sync failed for user', { 
      userId: connection.user_id, 
      error
    });
    return { 
      userId: connection.user_id, 
      error: error instanceof Error ? error.message : String(error), 
      success: false 
    };
  }
};

// Scheduled sync function - runs every 4 hours
export const scheduledWithingsSync = inngest.createFunction(
  { id: 'withings-scheduled-sync' },
  { cron: '0 */4 * * *' }, // Every 4 hours
  async ({ step }) => {
    const syncEngine = new WithingsSyncEngine();
    
    // Step 1: Get all active connections that need sync
    const connections = await step.run('get-connections-needing-sync', async () => {
      const { createClient } = await import('@/utils/supabase/server');
      const supabase = createClient();
      
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

    apiLogger.info('Scheduled Withings sync started', { connectionsToSync: connections.length });

    // Step 2: Process each connection that needs sync
    const results = await step.run('process-sync-jobs', async () => {
      const promises = connections.map(connection => 
        processSingleConnection(connection, syncEngine)
      );

      return Promise.allSettled(promises);
    });

    const successfulSyncs = results.filter(r => 
      r.status === 'fulfilled' && r.value.success
    ).length;

    apiLogger.info('Scheduled Withings sync completed', { 
      processedConnections: connections.length,
      successfulSyncs,
      failedSyncs: connections.length - successfulSyncs
    });

    return {
      processedConnections: connections.length,
      successfulSyncs,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason })
    };
  }
);

// Manual sync function - triggered by API endpoints
export const manualWithingsSync = inngest.createFunction(
  { id: 'withings-manual-sync' },
  { event: 'withings/sync.manual' },
  async ({ event, step }) => {
    const { userId, options, eventId } = event.data;
    const syncEngine = new WithingsSyncEngine();

    apiLogger.info('Manual Withings sync started', { userId, eventId });

    // Start the sync process
    const jobId = await step.run('start-manual-sync', async () => {
      return syncEngine.startSync(userId, {
        ...options,
        jobType: 'manual'
      }, eventId);
    });

    // Wait for sync completion with timeout
    const result = await step.run('wait-for-completion', async () => {
      try {
        return await syncEngine.waitForSyncCompletion(jobId, 300000); // 5 minute timeout
      } catch (error: unknown) {
        apiLogger.error('Failed to wait for sync completion', {
          jobId,
          userId,
          error
        });
        throw error;
      }
    });

    apiLogger.info('Manual Withings sync completed', { 
      userId, 
      jobId, 
      result 
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
    const { userId, dateRange, eventId } = event.data;
    const syncEngine = new WithingsSyncEngine();

    apiLogger.info('Historical Withings sync started', { 
      userId, 
      dateRange, 
      eventId 
    });

    // Process historical data in batches to avoid timeouts
    const jobId = await step.run('start-historical-sync', async () => {
      return syncEngine.startSync(userId, {
        jobType: 'historical',
        startDate: new Date(dateRange.startDate),
        endDate: new Date(dateRange.endDate),
        batchSize: 100 // Process in smaller batches
      }, eventId);
    });

    apiLogger.info('Historical Withings sync job created', { 
      userId, 
      jobId, 
      dateRange 
    });

    return {
      userId,
      jobId,
      dateRange
    };
  }
);