import { WithingsWebhookNotification, ProcessingResult, WithingsConnection } from './types';
import { createClient } from '@/utils/supabase/server';

export class WithingsWebhookProcessor {
  /**
   * Process incoming webhook notification
   */
  async processWebhook(
    webhookId: string,
    notification: WithingsWebhookNotification
  ): Promise<ProcessingResult> {
    try {
      // Find user connection
      const connection = await this.findUserConnection(notification.userid);
      if (!connection) {
        throw new Error(`No connection found for Withings user ${notification.userid}`);
      }

      // Log webhook event
      const eventId = await this.logWebhookEvent(webhookId, connection, notification);

      // Mark as processing
      await this.updateWebhookStatus(eventId, 'processing');

      // Process based on application type
      const result = await this.processApplicationData(
        connection.user_id,
        notification
      );

      // Mark as completed
      await this.updateWebhookStatus(eventId, 'completed');

      return result;

    } catch (error) {
      console.error(`Webhook processing failed for ${webhookId}:`, error);
      
      // Update webhook status with error
      const eventId = await this.findWebhookEventId(webhookId);
      if (eventId) {
        await this.updateWebhookStatus(eventId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      }

      throw error;
    }
  }

  /**
   * Process data based on Withings application type
   */
  private async processApplicationData(
    userId: string,
    notification: WithingsWebhookNotification
  ): Promise<ProcessingResult> {
    const startDate = new Date(notification.startdate * 1000);
    const endDate = new Date(notification.enddate * 1000);

    switch (notification.appli) {
      case 1: // Weight measurements
        return this.processWeightMeasurements(userId, startDate, endDate);
      
      case 4: // Blood pressure measurements
        return this.processCirculatoryMeasurements(userId, startDate, endDate);
      
      case 16: // Activity data
        return this.processActivityData(userId, startDate, endDate);
      
      case 44: // Sleep data
        return this.processSleepData(userId, startDate, endDate);
      
      case 46: // Device events
        return this.processDeviceEvents(userId, notification);
      
      default:
        console.warn(`Unknown application type: ${notification.appli}`);
        return { processed: 0, synced: 0, skipped: 0 };
    }
  }

  /**
   * Process weight measurements
   */
  private async processWeightMeasurements(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProcessingResult> {
    // Trigger sync engine for weight measurements
    // This would integrate with the sync engine from Phase 7.2
    const { WithingsSyncEngine } = await import('./sync-engine');
    const syncEngine = new WithingsSyncEngine();

    try {
      const result = await syncEngine.syncMeasurements(userId, {
        startDate,
        endDate,
        jobType: 'webhook',
        measurementTypes: ['weight', 'fat_ratio', 'muscle_mass', 'bone_mass', 'hydration']
      });

      return {
        processed: result.processed,
        synced: result.synced,
        skipped: result.skipped
      };
    } catch (error) {
      console.error('Failed to sync weight measurements:', error);
      return { processed: 0, synced: 0, skipped: 0 };
    }
  }

  /**
   * Process circulatory measurements (blood pressure, heart rate)
   */
  private async processCirculatoryMeasurements(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProcessingResult> {
    // For now, just log that we received circulatory data
    console.log(`Processing circulatory measurements for user ${userId} from ${startDate} to ${endDate}`);
    return { processed: 1, synced: 0, skipped: 1 };
  }

  /**
   * Process activity data
   */
  private async processActivityData(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProcessingResult> {
    // For now, just log that we received activity data
    console.log(`Processing activity data for user ${userId} from ${startDate} to ${endDate}`);
    return { processed: 1, synced: 0, skipped: 1 };
  }

  /**
   * Process sleep data
   */
  private async processSleepData(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProcessingResult> {
    // For now, just log that we received sleep data
    console.log(`Processing sleep data for user ${userId} from ${startDate} to ${endDate}`);
    return { processed: 1, synced: 0, skipped: 1 };
  }

  /**
   * Process device events (battery, connectivity, etc.)
   */
  private async processDeviceEvents(
    userId: string,
    _notification: WithingsWebhookNotification
  ): Promise<ProcessingResult> {
    // Trigger device manager to update device information
    const { WithingsDeviceManager } = await import('./device-manager');
    const deviceManager = new WithingsDeviceManager();
    
    try {
      await deviceManager.updateDevicesForUser(userId);
      return { processed: 1, synced: 1, skipped: 0 };
    } catch (error) {
      console.error('Failed to update devices:', error);
      return { processed: 1, synced: 0, skipped: 1 };
    }
  }

  /**
   * Find user connection by Withings user ID
   */
  private async findUserConnection(withingsUserId: string): Promise<WithingsConnection | null> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('withings_connections')
      .select('*')
      .eq('withings_user_id', withingsUserId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error finding user connection:', error);
      return null;
    }

    return data;
  }

  /**
   * Log webhook event to database
   */
  private async logWebhookEvent(
    webhookId: string,
    connection: WithingsConnection,
    notification: WithingsWebhookNotification
  ): Promise<string> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('withings_webhook_events')
      .insert({
        webhook_id: webhookId,
        user_id: connection.user_id,
        connection_id: connection.id,
        event_type: this.getEventType(notification.appli),
        application: notification.appli,
        start_date: new Date(notification.startdate * 1000).toISOString(),
        end_date: new Date(notification.enddate * 1000).toISOString(),
        notification_date: new Date(notification.date * 1000).toISOString(),
        raw_payload: notification
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to log webhook event: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update webhook processing status
   */
  private async updateWebhookStatus(
    eventId: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    const supabase = createClient();
    
    const updateData: any = {
      processing_status: status,
      last_attempt_at: new Date().toISOString()
    };

    if (status === 'processing') {
      // In real implementation, we'd increment the attempts
      updateData.processing_attempts = 1;
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else if (status === 'failed') {
      updateData.error_message = errorMessage;
    }

    const { error } = await supabase
      .from('withings_webhook_events')
      .update(updateData)
      .eq('id', eventId);

    if (error) {
      console.error('Failed to update webhook status:', error);
    }
  }

  /**
   * Get event type string from application ID
   */
  private getEventType(appli: number): string {
    switch (appli) {
      case 1: return 'measurement';
      case 4: return 'measurement';
      case 16: return 'activity';
      case 44: return 'sleep';
      case 46: return 'device';
      default: return 'unknown';
    }
  }

  /**
   * Find webhook event ID by webhook ID
   */
  private async findWebhookEventId(webhookId: string): Promise<string | null> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('withings_webhook_events')
      .select('id')
      .eq('webhook_id', webhookId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.id;
  }
}
