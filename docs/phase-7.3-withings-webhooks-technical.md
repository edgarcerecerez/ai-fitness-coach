# Phase 7.3: Withings Real-time Updates & Webhooks

## Implementation Summary

### 🏗️ Technology Stack & Architecture
- **Primary Queue System**: **Inngest** for reliable webhook processing with built-in retries, monitoring, and scalability
- **Webhook Security**: HMAC-SHA256 signature validation with timing-safe comparison 
- **Message Queuing**: Hybrid approach using both Inngest and database-backed fallback queue
- **Real-time Triggers**: **Does NOT use Supabase Realtime** - instead uses webhook-driven processing
- **Push Notifications**: Multi-platform support (Web Push, APNS, FCM) with user preference management
- **Database**: PostgreSQL via Supabase with specialized webhook event tracking tables

### 🔄 Data Flow Architecture
1. **Withings Device** → Measurement taken
2. **Withings API** → Sends webhook to `/api/webhooks/withings`
3. **Security Validation** → HMAC signature + timestamp verification
4. **Inngest Queue** → Webhook queued for background processing
5. **Webhook Processor** → Extracts data, triggers sync engine from Phase 7.2
6. **Database Storage** → New measurements stored with conflict resolution
7. **Push Notifications** → Users notified of new data (if enabled)

### 🛠️ Key Technical Decisions
- **No Supabase Realtime**: Webhooks provide more reliable real-time updates than polling/realtime subscriptions
- **Inngest over Redis**: Leverages existing Inngest infrastructure for consistency with Phase 7.2 sync jobs
- **Database-First Queuing**: Webhook events logged immediately for audit trail and retry capability
- **Hybrid Notification System**: Supports multiple platforms with graceful degradation
- **Signature-Based Security**: Industry standard HMAC validation prevents spoofed webhooks

### 🔧 Inngest Integration Details
- **Webhook Processing Function**: `webhookWithingsProcess` - handles individual webhook events
- **Device Update Function**: `deviceUpdateScheduled` - periodic device discovery and updates  
- **Notification Function**: `notificationSend` - handles push notification delivery
- **Error Handling**: Built-in exponential backoff, dead letter queue for failed webhooks
- **Monitoring**: Inngest dashboard provides real-time processing metrics and error tracking

### 🗃️ Database Design Highlights
- **Webhook Event Tracking**: Full audit trail with deduplication via `webhook_id`
- **Device State Management**: Real-time device battery, connectivity, and feature tracking
- **Notification Preferences**: Granular per-user settings with quiet hours support
- **Subscription Management**: Tracks active webhook subscriptions per application type

### 📋 Implementation Status
❌ **NOT YET IMPLEMENTED** - This phase is in planning/design stage

## Overview
This phase implements real-time data synchronization through Withings webhooks, enabling immediate processing of new measurements as they occur. It includes webhook endpoint security, message queue processing, push notifications, and device management.

## Technical Architecture

### Component Structure
```
src/
├── lib/
│   ├── withings/
│   │   ├── webhook-processor.ts   # Process webhook notifications
│   │   ├── webhook-security.ts    # Signature validation
│   │   ├── device-manager.ts      # Device discovery and management
│   │   └── notification-service.ts # Push notifications
│   ├── queue/
│   │   ├── webhook-queue.ts       # Message queue for webhooks
│   │   ├── dead-letter-queue.ts   # Failed message handling
│   │   └── retry-handler.ts       # Retry logic with backoff
│   └── notifications/
│       └── push-service.ts        # Push notification service
├── app/api/
│   ├── webhooks/
│   │   └── withings/route.ts      # Webhook receiver endpoint
│   └── integrations/withings/
│       ├── devices/route.ts       # Device management
│       └── notifications/route.ts # Notification preferences
└── components/
    └── settings/
        ├── withings-devices.tsx     # Device list and management
        └── notification-settings.tsx # Notification preferences
```

## Database Schema Extensions

```sql
-- Webhook processing log
CREATE TABLE withings_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id VARCHAR UNIQUE NOT NULL, -- Withings webhook ID for deduplication
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES withings_connections(id) ON DELETE CASCADE,
  event_type VARCHAR NOT NULL, -- 'measurement', 'device', 'user'
  application INTEGER NOT NULL, -- Withings application ID (1=weight, 4=circulatory, etc.)
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  notification_date TIMESTAMP WITH TIME ZONE NOT NULL,
  raw_payload JSONB NOT NULL,
  processing_status VARCHAR DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  processing_attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for webhook queries
CREATE INDEX idx_withings_webhooks_webhook_id ON withings_webhook_events(webhook_id);
CREATE INDEX idx_withings_webhooks_user_id ON withings_webhook_events(user_id);
CREATE INDEX idx_withings_webhooks_status ON withings_webhook_events(processing_status);
CREATE INDEX idx_withings_webhooks_created_at ON withings_webhook_events(created_at);
CREATE INDEX idx_withings_webhooks_pending ON withings_webhook_events(processing_status, created_at) WHERE processing_status = 'pending';

-- Enhanced device tracking
ALTER TABLE withings_devices ADD COLUMN model_id INTEGER;
ALTER TABLE withings_devices ADD COLUMN features TEXT[]; -- Available features like 'body_composition', 'heart_rate'
ALTER TABLE withings_devices ADD COLUMN notification_enabled BOOLEAN DEFAULT true;
ALTER TABLE withings_devices ADD COLUMN last_webhook_at TIMESTAMP WITH TIME ZONE;

-- Notification preferences
CREATE TABLE withings_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  measurement_notifications BOOLEAN DEFAULT true,
  achievement_notifications BOOLEAN DEFAULT true,
  sync_failure_notifications BOOLEAN DEFAULT true,
  notification_methods TEXT[] DEFAULT '{"push"}', -- 'push', 'email'
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone VARCHAR DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Push notification tokens
CREATE TABLE user_notification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR NOT NULL, -- 'web', 'ios', 'android'
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(token)
);

CREATE INDEX idx_notification_tokens_user_id ON user_notification_tokens(user_id);
CREATE INDEX idx_notification_tokens_active ON user_notification_tokens(is_active);

-- Webhook subscription management
CREATE TABLE withings_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES withings_connections(id) ON DELETE CASCADE,
  withings_subscription_id VARCHAR,
  application INTEGER NOT NULL, -- 1=weight, 4=circulatory, 16=activity, 44=sleep
  callback_url TEXT NOT NULL,
  comment TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(connection_id, application)
);
```

## Implementation Details

### 1. Webhook Security & Validation

```typescript
// src/lib/withings/webhook-security.ts
import crypto from 'crypto';

export class WithingsWebhookSecurity {
  private readonly clientSecret: string;

  constructor() {
    this.clientSecret = process.env.WITHINGS_CLIENT_SECRET!;
  }

  /**
   * Validate webhook signature
   */
  validateSignature(payload: string, signature: string, timestamp: string): boolean {
    // Withings uses HMAC-SHA256 for signature validation
    const expectedSignature = this.generateSignature(payload, timestamp);
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Generate expected signature
   */
  private generateSignature(payload: string, timestamp: string): string {
    const data = `${timestamp}${payload}`;
    return crypto
      .createHmac('sha256', this.clientSecret)
      .update(data, 'utf8')
      .digest('hex');
  }

  /**
   * Check if timestamp is within acceptable range (5 minutes)
   */
  isTimestampValid(timestamp: string): boolean {
    const webhookTime = parseInt(timestamp, 10) * 1000; // Convert to milliseconds
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    return Math.abs(now - webhookTime) <= fiveMinutes;
  }

  /**
   * Validate webhook payload structure
   */
  validatePayload(payload: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!payload.userid) {
      errors.push('Missing userid');
    }

    if (!payload.appli) {
      errors.push('Missing application ID');
    }

    if (!payload.startdate || !payload.enddate) {
      errors.push('Missing date range');
    }

    if (!payload.date) {
      errors.push('Missing notification date');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

### 2. Webhook Event Processor

```typescript
// src/lib/withings/webhook-processor.ts
import { WithingsWebhookNotification, ProcessingResult } from './types';
import { WithingsSyncEngine } from './sync-engine';
import { WithingsNotificationService } from './notification-service';
import { WithingsDeviceManager } from './device-manager';

export class WithingsWebhookProcessor {
  private syncEngine: WithingsSyncEngine;
  private notificationService: WithingsNotificationService;
  private deviceManager: WithingsDeviceManager;

  constructor() {
    this.syncEngine = new WithingsSyncEngine();
    this.notificationService = new WithingsNotificationService();
    this.deviceManager = new WithingsDeviceManager();
  }

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
        connection.userId,
        notification,
        eventId
      );

      // Mark as completed
      await this.updateWebhookStatus(eventId, 'completed');

      // Send notification to user if enabled
      await this.sendUserNotification(connection.userId, notification, result);

      return result;

    } catch (error) {
      console.error(`Webhook processing failed for ${webhookId}:`, error);
      
      // Update webhook status with error
      const eventId = await this.findWebhookEventId(webhookId);
      if (eventId) {
        await this.updateWebhookStatus(eventId, 'failed', error.message);
      }

      throw error;
    }
  }

  /**
   * Process data based on Withings application type
   */
  private async processApplicationData(
    userId: string,
    notification: WithingsWebhookNotification,
    eventId: string
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
    // Use sync engine to fetch and process measurements
    const jobId = await this.syncEngine.startSync(userId, {
      jobType: 'webhook',
      startDate,
      endDate,
      measurementTypes: ['weight', 'fat_ratio', 'muscle_mass', 'bone_mass', 'hydration']
    });

    // Wait for sync completion (with timeout)
    return this.waitForSyncCompletion(jobId, 30000); // 30 second timeout
  }

  /**
   * Process device events (battery, connectivity, etc.)
   */
  private async processDeviceEvents(
    userId: string,
    notification: WithingsWebhookNotification
  ): Promise<ProcessingResult> {
    await this.deviceManager.updateDevicesForUser(userId);
    
    return { processed: 1, synced: 1, skipped: 0 };
  }

  /**
   * Find user connection by Withings user ID
   */
  private async findUserConnection(withingsUserId: string): Promise<any> {
    const { supabase } = await import('@/utils/supabase/server');
    
    const { data } = await supabase
      .from('withings_connections')
      .select('*')
      .eq('withings_user_id', withingsUserId)
      .eq('is_active', true)
      .single();

    return data;
  }

  /**
   * Log webhook event to database
   */
  private async logWebhookEvent(
    webhookId: string,
    connection: any,
    notification: WithingsWebhookNotification
  ): Promise<string> {
    const { supabase } = await import('@/utils/supabase/server');
    
    const { data, error } = await supabase
      .from('withings_webhook_events')
      .insert({
        webhook_id: webhookId,
        user_id: connection.userId,
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
    const { supabase } = await import('@/utils/supabase/server');
    
    const updateData: any = {
      processing_status: status,
      last_attempt_at: new Date().toISOString()
    };

    if (status === 'processing') {
      updateData.processing_attempts = 1; // Increment in real implementation
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else if (status === 'failed') {
      updateData.error_message = errorMessage;
    }

    await supabase
      .from('withings_webhook_events')
      .update(updateData)
      .eq('id', eventId);
  }

  /**
   * Send notification to user about new data
   */
  private async sendUserNotification(
    userId: string,
    notification: WithingsWebhookNotification,
    result: ProcessingResult
  ): Promise<void> {
    if (result.synced === 0) return; // No new data to notify about

    const message = this.createNotificationMessage(notification.appli, result);
    await this.notificationService.sendNotification(userId, {
      title: 'New Health Data Synced',
      message,
      data: {
        type: 'withings_sync',
        application: notification.appli,
        synced_count: result.synced
      }
    });
  }

  /**
   * Create user-friendly notification message
   */
  private createNotificationMessage(appli: number, result: ProcessingResult): string {
    switch (appli) {
      case 1:
        return `New weight measurement synced from your Withings scale`;
      case 4:
        return `New blood pressure reading synced from your Withings device`;
      case 16:
        return `Activity data synced from your Withings device`;
      case 44:
        return `Sleep data synced from your Withings device`;
      default:
        return `New health data synced from your Withings device`;
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
   * Wait for sync job completion
   */
  private async waitForSyncCompletion(
    jobId: string,
    timeoutMs: number
  ): Promise<ProcessingResult> {
    const { supabase } = await import('@/utils/supabase/server');
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const { data: job } = await supabase
        .from('withings_sync_jobs')
        .select('status, measurements_processed, measurements_synced, measurements_skipped')
        .eq('id', jobId)
        .single();

      if (!job) break;

      if (job.status === 'completed') {
        return {
          processed: job.measurements_processed || 0,
          synced: job.measurements_synced || 0,
          skipped: job.measurements_skipped || 0
        };
      }

      if (job.status === 'failed') {
        throw new Error('Sync job failed');
      }

      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Sync job timeout');
  }

  private async findWebhookEventId(webhookId: string): Promise<string | null> {
    const { supabase } = await import('@/utils/supabase/server');
    
    const { data } = await supabase
      .from('withings_webhook_events')
      .select('id')
      .eq('webhook_id', webhookId)
      .single();

    return data?.id || null;
  }
}
```

### 3. Device Management Service

```typescript
// src/lib/withings/device-manager.ts
import { WithingsApiClient } from './client';
import { WithingsDevice } from './types';

export class WithingsDeviceManager {
  private apiClient: WithingsApiClient;

  constructor() {
    this.apiClient = new WithingsApiClient();
  }

  /**
   * Update device list for user
   */
  async updateDevicesForUser(userId: string): Promise<WithingsDevice[]> {
    try {
      // Fetch devices from Withings API
      const response = await this.apiClient.makeRequest(userId, '/v2/user', {
        action: 'getdevice'
      });

      const devices = this.parseDevicesResponse(response);
      
      // Update database
      await this.updateDevicesInDatabase(userId, devices);
      
      return devices;
    } catch (error) {
      console.error(`Failed to update devices for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Parse devices from Withings API response
   */
  private parseDevicesResponse(response: any): WithingsDevice[] {
    if (!response.body || !response.body.devices) {
      return [];
    }

    return response.body.devices.map((device: any) => ({
      id: device.deviceid,
      type: this.getDeviceType(device.type),
      model: device.model,
      modelId: device.model_id,
      batteryLevel: device.battery,
      timezone: device.timezone,
      lastSessionDate: device.last_session_date ? new Date(device.last_session_date * 1000) : null,
      features: this.getDeviceFeatures(device.type, device.model_id)
    }));
  }

  /**
   * Update devices in database
   */
  private async updateDevicesInDatabase(userId: string, devices: WithingsDevice[]): Promise<void> {
    const { supabase } = await import('@/utils/supabase/server');
    
    // Get connection ID
    const { data: connection } = await supabase
      .from('withings_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!connection) {
      throw new Error('No active connection found');
    }

    // Update or insert devices
    for (const device of devices) {
      await supabase
        .from('withings_devices')
        .upsert({
          connection_id: connection.id,
          device_id: device.id,
          device_model: device.model,
          device_type: device.type,
          model_id: device.modelId,
          battery_level: device.batteryLevel,
          timezone: device.timezone,
          last_session_date: device.lastSessionDate?.toISOString(),
          features: device.features,
          last_seen_at: new Date().toISOString(),
          is_active: true
        }, {
          onConflict: 'connection_id,device_id'
        });
    }

    // Mark devices not in the response as inactive
    const deviceIds = devices.map(d => d.id);
    if (deviceIds.length > 0) {
      await supabase
        .from('withings_devices')
        .update({ is_active: false })
        .eq('connection_id', connection.id)
        .not('device_id', 'in', `(${deviceIds.map(id => `'${id}'`).join(',')})`);
    }
  }

  /**
   * Get device type from Withings type code
   */
  private getDeviceType(typeCode: number): string {
    switch (typeCode) {
      case 1: return 'scale';
      case 4: return 'blood_pressure';
      case 16: return 'activity_tracker';
      case 32: return 'sleep_monitor';
      case 64: return 'thermometer';
      default: return 'unknown';
    }
  }

  /**
   * Get device features based on type and model
   */
  private getDeviceFeatures(typeCode: number, modelId?: number): string[] {
    const features: string[] = [];

    if (typeCode === 1) { // Scale
      features.push('weight');
      
      // Advanced scales with body composition
      if (modelId && [21, 32, 61, 93].includes(modelId)) {
        features.push('body_composition', 'muscle_mass', 'bone_mass', 'water_percentage');
      }
      
      // Heart rate capable scales
      if (modelId && [32, 61, 93].includes(modelId)) {
        features.push('heart_rate');
      }
    }

    return features;
  }

  /**
   * Get devices for user
   */
  async getDevicesForUser(userId: string): Promise<WithingsDevice[]> {
    const { supabase } = await import('@/utils/supabase/server');
    
    const { data: devices } = await supabase
      .from('withings_devices')
      .select(`
        *,
        connection:withings_connections!inner(user_id)
      `)
      .eq('connection.user_id', userId)
      .eq('is_active', true)
      .order('last_seen_at', { ascending: false });

    return (devices || []).map(device => ({
      id: device.device_id,
      type: device.device_type,
      model: device.device_model,
      modelId: device.model_id,
      batteryLevel: device.battery_level,
      timezone: device.timezone,
      lastSessionDate: device.last_session_date ? new Date(device.last_session_date) : null,
      features: device.features || [],
      lastSeenAt: new Date(device.last_seen_at)
    }));
  }

  /**
   * Toggle device notifications
   */
  async toggleDeviceNotifications(userId: string, deviceId: string, enabled: boolean): Promise<void> {
    const { supabase } = await import('@/utils/supabase/server');
    
    await supabase
      .from('withings_devices')
      .update({ notification_enabled: enabled })
      .eq('device_id', deviceId)
      .eq('connection.user_id', userId);
  }
}
```

### 4. Notification Service

```typescript
// src/lib/withings/notification-service.ts
import { NotificationPayload } from './types';

export class WithingsNotificationService {
  /**
   * Send notification to user
   */
  async sendNotification(userId: string, payload: NotificationPayload): Promise<void> {
    // Check user preferences
    const preferences = await this.getUserPreferences(userId);
    if (!preferences.measurement_notifications) return;

    // Check quiet hours
    if (this.isInQuietHours(preferences)) return;

    // Get active notification tokens
    const tokens = await this.getUserTokens(userId);
    if (tokens.length === 0) return;

    // Send to each platform
    await Promise.allSettled(
      tokens.map(token => this.sendToToken(token, payload))
    );
  }

  /**
   * Send push notification to specific token
   */
  private async sendToToken(token: any, payload: NotificationPayload): Promise<void> {
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
    }
  }

  /**
   * Get user notification preferences
   */
  private async getUserPreferences(userId: string): Promise<any> {
    const { supabase } = await import('@/utils/supabase/server');
    
    const { data } = await supabase
      .from('withings_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    return data || {
      measurement_notifications: true,
      achievement_notifications: true,
      sync_failure_notifications: true
    };
  }

  /**
   * Check if current time is in user's quiet hours
   */
  private isInQuietHours(preferences: any): boolean {
    if (!preferences.quiet_hours_start || !preferences.quiet_hours_end) {
      return false;
    }

    const now = new Date();
    const timezone = preferences.timezone || 'UTC';
    
    // Convert to user's timezone and check against quiet hours
    // Implementation depends on timezone library
    return false; // Simplified for example
  }

  /**
   * Get active notification tokens for user
   */
  private async getUserTokens(userId: string): Promise<any[]> {
    const { supabase } = await import('@/utils/supabase/server');
    
    const { data } = await supabase
      .from('user_notification_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    return data || [];
  }

  /**
   * Send web push notification
   */
  private async sendWebPush(token: string, payload: NotificationPayload): Promise<void> {
    // Implement web push using service like Firebase or native Web Push API
    console.log('Sending web push:', { token, payload });
  }

  /**
   * Send APNS notification
   */
  private async sendAPNS(token: string, payload: NotificationPayload): Promise<void> {
    // Implement APNS
    console.log('Sending APNS:', { token, payload });
  }

  /**
   * Send FCM notification
   */
  private async sendFCM(token: string, payload: NotificationPayload): Promise<void> {
    // Implement FCM
    console.log('Sending FCM:', { token, payload });
  }
}
```

## API Routes

### 1. Webhook Receiver Endpoint

```typescript
// src/app/api/webhooks/withings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { WithingsWebhookSecurity } from '@/lib/withings/webhook-security';
import { WithingsWebhookProcessor } from '@/lib/withings/webhook-processor';
import { WithingsWebhookQueue } from '@/lib/queue/webhook-queue';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-withings-signature');
    const timestamp = request.headers.get('x-withings-timestamp');
    
    if (!signature || !timestamp) {
      return NextResponse.json({ error: 'Missing signature or timestamp' }, { status: 400 });
    }

    const rawBody = await request.text();
    
    // Validate signature and timestamp
    const security = new WithingsWebhookSecurity();
    
    if (!security.isTimestampValid(timestamp)) {
      return NextResponse.json({ error: 'Invalid timestamp' }, { status: 400 });
    }

    if (!security.validateSignature(rawBody, signature, timestamp)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse and validate payload
    const payload = JSON.parse(rawBody);
    const validation = security.validatePayload(payload);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Invalid payload', details: validation.errors }, { status: 400 });
    }

    // Generate unique webhook ID for deduplication
    const webhookId = `${payload.userid}_${payload.appli}_${payload.date}`;

    // Check for duplicate webhook
    const { supabase } = await import('@/utils/supabase/server');
    const { data: existing } = await supabase
      .from('withings_webhook_events')
      .select('id')
      .eq('webhook_id', webhookId)
      .single();

    if (existing) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Queue webhook for processing via Inngest
    const { inngest } = await import('@/lib/inngest/client');
    await inngest.send({
      name: 'withings/webhook.received',
      data: {
        webhookId,
        payload
      }
    });

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

### 2. Device Management API

```typescript
// src/app/api/integrations/withings/devices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { WithingsDeviceManager } from '@/lib/withings/device-manager';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deviceManager = new WithingsDeviceManager();
    const devices = await deviceManager.getDevicesForUser(user.id);

    return NextResponse.json({ devices });
  } catch (error) {
    console.error('Failed to get devices:', error);
    return NextResponse.json({ error: 'Failed to get devices' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, deviceId, enabled } = await request.json();

    const deviceManager = new WithingsDeviceManager();

    switch (action) {
      case 'refresh':
        const devices = await deviceManager.updateDevicesForUser(user.id);
        return NextResponse.json({ devices });
      
      case 'toggle_notifications':
        if (!deviceId || typeof enabled !== 'boolean') {
          return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }
        await deviceManager.toggleDeviceNotifications(user.id, deviceId, enabled);
        return NextResponse.json({ success: true });
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Device management error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## Message Queue Implementation

### 1. Inngest Webhook Functions

```typescript
// src/lib/inngest/withings-webhooks.ts
import { inngest } from '@/lib/inngest/client';
import { WithingsWebhookProcessor } from '@/lib/withings/webhook-processor';

// Primary webhook processing function
export const webhookWithingsProcess = inngest.createFunction(
  { id: 'webhook-withings-process' },
  { event: 'withings/webhook.received' },
  async ({ event, step }) => {
    const { webhookId, payload } = event.data;
    const processor = new WithingsWebhookProcessor();

    // Step 1: Validate and log webhook
    const eventId = await step.run('log-webhook-event', async () => {
      return processor.logWebhookEvent(webhookId, payload);
    });

    // Step 2: Process webhook data
    const result = await step.run('process-webhook-data', async () => {
      return processor.processWebhook(webhookId, payload);
    });

    // Step 3: Send user notifications
    await step.run('send-notifications', async () => {
      return processor.sendNotifications(eventId, result);
    });

    return { webhookId, eventId, result };
  }
);

// Device update function
export const deviceUpdateScheduled = inngest.createFunction(
  { id: 'device-update-scheduled' },
  { cron: '0 */6 * * *' }, // Every 6 hours
  async ({ step }) => {
    const deviceManager = new WithingsDeviceManager();
    
    const activeConnections = await step.run('get-active-connections', async () => {
      return deviceManager.getActiveConnections();
    });

    const results = await step.run('update-all-devices', async () => {
      return Promise.allSettled(
        activeConnections.map(conn => 
          deviceManager.updateDevicesForUser(conn.user_id)
        )
      );
    });

    return { processed: activeConnections.length, results };
  }
);
```

### 2. Webhook Message Queue (Fallback)

```typescript
// src/lib/queue/webhook-queue.ts  
export class WithingsWebhookQueue {
  private static instance: WithingsWebhookQueue;
  private processor: WithingsWebhookProcessor;

  constructor() {
    this.processor = new WithingsWebhookProcessor();
  }

  static getInstance(): WithingsWebhookQueue {
    if (!WithingsWebhookQueue.instance) {
      WithingsWebhookQueue.instance = new WithingsWebhookQueue();
    }
    return WithingsWebhookQueue.instance;
  }

  /**
   * Enqueue webhook for processing
   */
  async enqueue(webhookId: string, payload: any): Promise<void> {
    // In production, use Redis, Bull, or similar queue system
    // For now, process immediately in background
    this.processInBackground(webhookId, payload);
  }

  /**
   * Process webhook in background
   */
  private async processInBackground(webhookId: string, payload: any): Promise<void> {
    try {
      await this.processor.processWebhook(webhookId, payload);
    } catch (error) {
      console.error(`Background processing failed for ${webhookId}:`, error);
      
      // Add to dead letter queue for retry
      await this.addToDeadLetterQueue(webhookId, payload, error);
    }
  }

  /**
   * Add failed webhook to dead letter queue
   */
  private async addToDeadLetterQueue(
    webhookId: string, 
    payload: any, 
    error: any
  ): Promise<void> {
    const { supabase } = await import('@/utils/supabase/server');
    
    await supabase
      .from('withings_webhook_events')
      .update({
        processing_status: 'failed',
        error_message: error.message,
        processing_attempts: 1 // Increment in real implementation
      })
      .eq('webhook_id', webhookId);
  }
}
```

## Webhook Subscription Management

### 1. Subscription Setup

```typescript
// src/lib/withings/webhook-subscriptions.ts
import { WithingsApiClient } from './client';

export class WithingsWebhookSubscriptions {
  private apiClient: WithingsApiClient;

  constructor() {
    this.apiClient = new WithingsApiClient();
  }

  /**
   * Subscribe to webhooks for user
   */
  async subscribeUser(userId: string, applications: number[] = [1, 4, 16, 44]): Promise<void> {
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/withings`;
    
    for (const appId of applications) {
      try {
        const response = await this.apiClient.makeRequest(userId, '/notify', {
          action: 'subscribe',
          callbackurl: callbackUrl,
          appli: appId,
          comment: `AI Fitness Coach - ${this.getApplicationName(appId)}`
        });

        if (response.status === 0) {
          await this.recordSubscription(userId, appId, callbackUrl);
        }
      } catch (error) {
        console.error(`Failed to subscribe to app ${appId} for user ${userId}:`, error);
      }
    }
  }

  /**
   * Unsubscribe from webhooks
   */
  async unsubscribeUser(userId: string): Promise<void> {
    // Get existing subscriptions
    const subscriptions = await this.getUserSubscriptions(userId);
    
    for (const subscription of subscriptions) {
      try {
        await this.apiClient.makeRequest(userId, '/notify', {
          action: 'revoke',
          appli: subscription.application
        });

        await this.deactivateSubscription(subscription.id);
      } catch (error) {
        console.error(`Failed to unsubscribe from app ${subscription.application}:`, error);
      }
    }
  }

  /**
   * Record subscription in database
   */
  private async recordSubscription(
    userId: string,
    application: number,
    callbackUrl: string
  ): Promise<void> {
    const { supabase } = await import('@/utils/supabase/server');
    
    // Get connection
    const { data: connection } = await supabase
      .from('withings_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!connection) return;

    await supabase
      .from('withings_webhook_subscriptions')
      .upsert({
        connection_id: connection.id,
        application,
        callback_url: callbackUrl,
        comment: `AI Fitness Coach - ${this.getApplicationName(application)}`,
        is_active: true
      }, {
        onConflict: 'connection_id,application'
      });
  }

  private getApplicationName(appId: number): string {
    switch (appId) {
      case 1: return 'Weight';
      case 4: return 'Blood Pressure';
      case 16: return 'Activity';
      case 44: return 'Sleep';
      default: return 'Unknown';
    }
  }

  private async getUserSubscriptions(userId: string): Promise<any[]> {
    const { supabase } = await import('@/utils/supabase/server');
    
    const { data } = await supabase
      .from('withings_webhook_subscriptions')
      .select(`
        *,
        connection:withings_connections!inner(user_id)
      `)
      .eq('connection.user_id', userId)
      .eq('is_active', true);

    return data || [];
  }

  private async deactivateSubscription(subscriptionId: string): Promise<void> {
    const { supabase } = await import('@/utils/supabase/server');
    
    await supabase
      .from('withings_webhook_subscriptions')
      .update({ is_active: false })
      .eq('id', subscriptionId);
  }
}
```

## Testing Strategy

### Unit Tests
```typescript
// src/lib/withings/__tests__/webhook-processor.test.ts
describe('WithingsWebhookProcessor', () => {
  test('processes weight measurement webhook', async () => {
    const processor = new WithingsWebhookProcessor();
    const result = await processor.processWebhook('test-webhook', {
      userid: '12345',
      appli: 1,
      startdate: Math.floor(Date.now() / 1000),
      enddate: Math.floor(Date.now() / 1000),
      date: Math.floor(Date.now() / 1000)
    });

    expect(result.processed).toBeGreaterThanOrEqual(0);
  });
});
```

### Integration Tests
```typescript
// src/app/api/webhooks/__tests__/withings.test.ts
describe('Withings Webhook Endpoint', () => {
  test('validates webhook signature', async () => {
    // Test signature validation
  });

  test('processes valid webhook', async () => {
    // Test end-to-end webhook processing
  });
});
```

## Monitoring & Alerts

### Key Metrics
- Webhook processing success rate
- Processing latency (should be <5 seconds)
- Queue depth and processing throughput
- Device discovery and update frequency
- Notification delivery rates

### Alert Conditions
- Webhook failure rate >5% over 15 minutes
- Processing latency >10 seconds p95
- Queue backlog >100 messages
- No device updates for >24 hours for connected users

This webhook implementation provides reliable real-time data processing with comprehensive error handling, monitoring, and user notification capabilities.