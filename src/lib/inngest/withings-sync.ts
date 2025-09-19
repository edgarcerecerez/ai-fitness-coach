import { getInngestClient } from '@/lib/inngest/client';
import { WithingsSyncEngine } from '@/lib/withings/sync-engine';
import { WithingsWebhookProcessor } from '@/lib/withings/webhook-processor';
import { WithingsDeviceManager } from '@/lib/withings/device-manager';
import { WithingsNotificationService } from '@/lib/withings/notification-service';
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

// Phase 7.3: Webhook Processing Functions

// Primary webhook processing function
export const webhookWithingsProcess = inngest.createFunction(
  { id: 'webhook-withings-process' },
  { event: 'withings/webhook.received' },
  async ({ event, step }) => {
    const { webhookId, payload } = event.data;
    const processor = new WithingsWebhookProcessor();

    apiLogger.info('Processing Withings webhook', { webhookId, userId: payload.userid });

    // Step 1: Process webhook data
    const result = await step.run('process-webhook-data', async () => {
      try {
        return await processor.processWebhook(webhookId, payload);
      } catch (error) {
        apiLogger.error('Failed to process webhook', { webhookId, error });
        throw error;
      }
    });

    // Step 2: Send user notifications if data was synced
    if (result.synced > 0) {
      await step.run('send-notifications', async () => {
        try {
          const notificationService = new WithingsNotificationService();
          
          // Find user ID from webhook payload
          const { createClient } = await import('@/utils/supabase/server');
          const supabase = createClient();
          
          const { data: connection } = await supabase
            .from('withings_connections')
            .select('user_id')
            .eq('withings_user_id', payload.userid)
            .eq('is_active', true)
            .single();

          if (connection) {
            await notificationService.sendMeasurementNotification(
              connection.user_id,
              getApplicationTypeName(payload.appli),
              result.synced
            );
          }
        } catch (error) {
          apiLogger.error('Failed to send webhook notification', { webhookId, error });
          // Don't fail the entire webhook processing if notifications fail
        }
      });
    }

    apiLogger.info('Webhook processing completed', { 
      webhookId, 
      result,
      userId: payload.userid
    });

    return { webhookId, result };
  }
);

// Device update function - scheduled every 6 hours
export const deviceUpdateScheduled = inngest.createFunction(
  { id: 'device-update-scheduled' },
  { cron: '0 */6 * * *' }, // Every 6 hours
  async ({ step }) => {
    const deviceManager = new WithingsDeviceManager();
    
    // Get all active connections
    const activeConnections = await step.run('get-active-connections', async () => {
      return await deviceManager.getActiveConnections();
    });

    apiLogger.info('Scheduled device update started', { 
      connectionsToUpdate: activeConnections.length 
    });

    // Update devices for all active connections
    const results = await step.run('update-all-devices', async () => {
      const promises = activeConnections.map(async connection => {
        try {
          const devices = await deviceManager.updateDevicesForUser(connection.user_id);
          return { 
            userId: connection.user_id, 
            success: true, 
            deviceCount: devices.length 
          };
        } catch (error) {
          apiLogger.error('Failed to update devices for user', {
            userId: connection.user_id,
            error
          });
          return { 
            userId: connection.user_id, 
            success: false, 
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });

      return Promise.allSettled(promises);
    });

    const successCount = results.filter(r => 
      r.status === 'fulfilled' && r.value.success
    ).length;

    apiLogger.info('Scheduled device update completed', {
      processedConnections: activeConnections.length,
      successfulUpdates: successCount,
      failedUpdates: activeConnections.length - successCount
    });

    return { 
      processed: activeConnections.length, 
      successful: successCount,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason })
    };
  }
);

// Utility function to get application type name
function getApplicationTypeName(appli: number): string {
  switch (appli) {
    case 1: return 'weight';
    case 4: return 'blood_pressure';
    case 16: return 'activity';
    case 44: return 'sleep';
    case 46: return 'device';
    default: return 'unknown';
  }
}
