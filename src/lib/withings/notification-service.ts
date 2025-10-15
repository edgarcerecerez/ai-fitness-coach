import { NotificationPayload, WithingsNotificationPreferences, UserNotificationToken } from './types';
import { createClient } from '@/utils/supabase/server';

export class WithingsNotificationService {
  /**
   * Send notification to user
   */
  async sendNotification(userId: string, payload: NotificationPayload): Promise<void> {
    try {
      // Check user preferences
      const preferences = await this.fetchUserPreferences(userId);
      if (!preferences.measurement_notifications && payload.data?.type === 'withings_sync') {
        return;
      }

      // Check quiet hours
      if (this.isInQuietHours(preferences)) {
        console.log(`Skipping notification for user ${userId} due to quiet hours`);
        return;
      }

      // Get active notification tokens
      const tokens = await this.fetchUserTokens(userId);
      if (tokens.length === 0) {
        console.log(`No notification tokens found for user ${userId}`);
        return;
      }

      // Send to each platform
      const results = await Promise.allSettled(
        tokens.map(token => this.sendToToken(token, payload))
      );

      // Log any failures
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Failed to send notification to token ${tokens[index].id}:`, result.reason);
        }
      });

    } catch (error) {
      console.error(`Failed to send notification to user ${userId}:`, error);
    }
  }

  /**
   * Send push notification to specific token
   */
  private async sendToToken(token: UserNotificationToken, payload: NotificationPayload): Promise<void> {
    switch (token.platform) {
      case 'web':
        await this.sendWebPush(token.token, payload);
        break;
      case 'ios':
        await this.sendAPNS(token.token, payload);
        break;
      case 'android':
        await this.sendFCM(token.token, payload);
        break;
      default:
        console.warn(`Unknown platform: ${token.platform}`);
    }

    // Update last used timestamp
    await this.updateTokenLastUsed(token.id);
  }

  /**
   * Get user notification preferences
   */
  private async fetchUserPreferences(userId: string): Promise<WithingsNotificationPreferences> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('withings_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Return default preferences if none exist
      return {
        id: '',
        user_id: userId,
        measurement_notifications: true,
        achievement_notifications: true,
        sync_failure_notifications: true,
        notification_methods: ['push'],
        timezone: 'UTC',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    return data;
  }

  /**
   * Check if current time is in user's quiet hours
   */
  private isInQuietHours(preferences: WithingsNotificationPreferences): boolean {
    if (!preferences.quiet_hours_start || !preferences.quiet_hours_end) {
      return false;
    }

    try {
      const now = new Date();
      
      // For simplicity, we'll just check UTC time
      // In a production app, you'd want to use a proper timezone library
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      
      const quietStart = preferences.quiet_hours_start;
      const quietEnd = preferences.quiet_hours_end;
      
      // Simple time comparison (doesn't handle cross-midnight quiet hours properly)
      return currentTime >= quietStart && currentTime <= quietEnd;
    } catch (error) {
      console.error('Error checking quiet hours:', error);
      return false;
    }
  }

  /**
   * Get active notification tokens for user
   */
  private async fetchUserTokens(userId: string): Promise<UserNotificationToken[]> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('user_notification_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Error getting user tokens:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Send web push notification
   */
  private async sendWebPush(token: string, payload: NotificationPayload): Promise<void> {
    // This would integrate with a web push service like Firebase FCM or native Web Push API
    // For now, just log the notification
    console.log('Sending web push notification:', {
      token: token.substring(0, 20) + '...',
      title: payload.title,
      message: payload.message,
      data: payload.data
    });

    // In a real implementation:
    // - Use webpush library with VAPID keys
    // - Send to browser's push service endpoint
    // - Handle response and update token status if needed
  }

  /**
   * Send APNS notification (iOS)
   */
  private async sendAPNS(token: string, payload: NotificationPayload): Promise<void> {
    // This would integrate with Apple Push Notification Service
    // For now, just log the notification
    console.log('Sending APNS notification:', {
      token: token.substring(0, 20) + '...',
      title: payload.title,
      message: payload.message,
      data: payload.data
    });

    // In a real implementation:
    // - Use node-apn library
    // - Send to Apple's push servers
    // - Handle response and update token status if needed
  }

  /**
   * Send FCM notification (Android)
   */
  private async sendFCM(token: string, payload: NotificationPayload): Promise<void> {
    // This would integrate with Firebase Cloud Messaging
    // For now, just log the notification
    console.log('Sending FCM notification:', {
      token: token.substring(0, 20) + '...',
      title: payload.title,
      message: payload.message,
      data: payload.data
    });

    // In a real implementation:
    // - Use firebase-admin SDK
    // - Send to FCM endpoint
    // - Handle response and update token status if needed
  }

  /**
   * Update token last used timestamp
   */
  private async updateTokenLastUsed(tokenId: string): Promise<void> {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('user_notification_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenId);

    if (error) {
      console.error('Error updating token last used:', error);
    }
  }

  /**
   * Register new notification token
   */
  async registerToken(userId: string, token: string, platform: string): Promise<void> {
    const supabase = await createClient();
    
    // Upsert the token (create or update if exists)
    const { error } = await supabase
      .from('user_notification_tokens')
      .upsert({
        user_id: userId,
        token,
        platform,
        is_active: true,
        last_used_at: new Date().toISOString()
      }, {
        onConflict: 'token'
      });

    if (error) {
      throw new Error(`Failed to register notification token: ${error.message}`);
    }
  }

  /**
   * Retrieve saved notification preferences for the user.
   */
  async getPreferences(userId: string): Promise<WithingsNotificationPreferences> {
    return this.fetchUserPreferences(userId);
  }

  /**
   * Update user notification preferences and return the saved record.
   */
  async updatePreferences(
    userId: string,
    updates: Partial<Omit<WithingsNotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<WithingsNotificationPreferences> {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const payload: Record<string, unknown> = {
      user_id: userId,
      updated_at: now
    };

    if (typeof updates.measurement_notifications === 'boolean') {
      payload.measurement_notifications = updates.measurement_notifications;
    }

    if (typeof updates.achievement_notifications === 'boolean') {
      payload.achievement_notifications = updates.achievement_notifications;
    }

    if (typeof updates.sync_failure_notifications === 'boolean') {
      payload.sync_failure_notifications = updates.sync_failure_notifications;
    }

    if (Array.isArray(updates.notification_methods)) {
      payload.notification_methods = updates.notification_methods;
    }

    if (typeof updates.quiet_hours_start === 'string' || updates.quiet_hours_start === null) {
      payload.quiet_hours_start = updates.quiet_hours_start;
    }

    if (typeof updates.quiet_hours_end === 'string' || updates.quiet_hours_end === null) {
      payload.quiet_hours_end = updates.quiet_hours_end;
    }

    if (typeof updates.timezone === 'string') {
      payload.timezone = updates.timezone;
    }

    const { data, error } = await supabase
      .from('withings_notification_preferences')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to update notification preferences: ${error?.message ?? 'Unknown error'}`);
    }

    return data;
  }

  /**
   * List active notification tokens for a user.
   */
  async getActiveTokens(userId: string): Promise<UserNotificationToken[]> {
    return this.fetchUserTokens(userId);
  }

  /**
   * Deactivate a notification token.
   */
  async removeToken(userId: string, tokenId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('user_notification_tokens')
      .update({ is_active: false })
      .eq('id', tokenId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to remove notification token: ${error.message}`);
    }
  }

  /**
   * Send notification about new measurement data
   */
  async sendMeasurementNotification(userId: string, measurementType: string, count: number): Promise<void> {
    const message = this.createMeasurementMessage(measurementType, count);
    
    await this.sendNotification(userId, {
      title: 'New Health Data Synced',
      message,
      data: {
        type: 'withings_sync',
        measurement_type: measurementType,
        synced_count: count
      }
    });
  }

  /**
   * Create user-friendly measurement notification message
   */
  private createMeasurementMessage(measurementType: string, count: number): string {
    switch (measurementType) {
      case 'weight':
        return count === 1 
          ? 'New weight measurement synced from your Withings scale'
          : `${count} new weight measurements synced from your Withings scale`;
      case 'blood_pressure':
        return count === 1
          ? 'New blood pressure reading synced from your Withings device'
          : `${count} new blood pressure readings synced from your Withings device`;
      case 'activity':
        return 'Activity data synced from your Withings device';
      case 'sleep':
        return 'Sleep data synced from your Withings device';
      case 'device':
        return 'Your Withings device information has been refreshed';
      default:
        return count === 1
          ? 'New health data synced from your Withings device'
          : `${count} new health measurements synced from your Withings device`;
    }
  }
}
