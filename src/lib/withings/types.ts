// TypeScript interfaces for Withings integration

export interface WithingsAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly scopes: readonly string[];
}

export interface WithingsTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
  readonly userId: string;
  readonly scope: string;
}

export interface WithingsConnection {
  readonly id: string;
  readonly userId: string;
  readonly withingsUserId: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
  readonly scopes: readonly string[];
  readonly isActive: boolean;
  readonly lastSyncAt: Date | null;
  readonly connectedAt: Date;
  readonly lastTokenRefreshAt?: Date;
  readonly refreshFailureCount: number;
}

export interface EncryptedData {
  readonly encryptedData: string;
  readonly iv: string;
  readonly authTag: string;
}

// Withings API response types
export interface WithingsMeasureGroup {
  grpid: number;
  attrib: number;
  date: number;
  created: number;
  category: number;
  deviceid?: string;
  measures: Array<{
    value: number;
    type: number;
    unit: number;
    algo?: number;
    fm?: number;
  }>;
}

// Database record types
export interface WithingsConnectionRecord {
  readonly id: string;
  readonly user_id: string;
  readonly withings_user_id: string;
  readonly access_token_encrypted: string;
  readonly refresh_token_encrypted: string;
  readonly token_expires_at: string;
  readonly scopes: readonly string[];
  readonly connected_at: string;
  readonly last_sync_at?: string;
  readonly last_token_refresh_at?: string;
  readonly refresh_failure_count: number;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface WithingsAuthStateRecord {
  readonly id: string;
  readonly state: string;
  readonly user_id: string;
  readonly code_verifier: string;
  readonly expires_at: string;
  readonly created_at: string;
}

export interface WithingsConnectionEventRecord {
  readonly id: string;
  readonly connection_id: string;
  readonly event_type: string;
  readonly event_data: Readonly<Record<string, unknown>>;
  readonly created_at: string;
}

// OAuth flow types
export interface AuthUrlResponse {
  readonly authUrl: string;
  readonly state: string;
  readonly codeVerifier: string;
}

// API response types
export type WithingsApiSuccess<T = unknown> = {
  readonly status: number;
  readonly ok: true;
  readonly body: T;
};

export type WithingsApiFailure = {
  readonly status: number;
  readonly ok: false;
  readonly error: {
    readonly message: string;
    readonly code?: string;
    readonly cause?: unknown;
  };
};

export type WithingsApiResponse<T = unknown> =
  | WithingsApiSuccess<T>
  | WithingsApiFailure;

// Connection status types
export interface ConnectionStatus {
  readonly isConnected: boolean;
  readonly connectedAt?: Date;
  readonly lastSyncAt?: Date;
  readonly withingsUserId?: string;
  readonly scopes?: readonly string[];
}

// Error types
export class WithingsApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'WithingsApiError';
  }
}

export class WithingsAuthError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'WithingsAuthError';
  }
}

export class WithingsRateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number
  ) {
    super(message);
    this.name = 'WithingsRateLimitError';
  }
}

// Phase 7.2: Data Sync Types

export interface WithingsMeasurement {
  readonly id: string;
  readonly groupId: number;
  readonly type: number;
  readonly value: number;
  readonly unit: number;
  readonly timestamp: Date;
  readonly deviceId?: string;
  readonly category?: number;
  readonly comment?: string;
}

export interface SyncJobOptions {
  readonly jobType?: 'manual' | 'webhook' | 'scheduled' | 'historical';
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly lastUpdate?: Date;
  readonly measurementTypes?: readonly string[];
  readonly batchSize?: number;
}

export interface SyncResult {
  readonly processed: number;
  readonly synced: number;
  readonly skipped: number;
}

export interface ProcessedMeasurement {
  readonly weight?: number;
  readonly height?: number;
  readonly fatFreeMass?: number;
  readonly bodyFat?: number;
  readonly fatMass?: number;
  readonly muscleMass?: number;
  readonly hydration?: number;
  readonly boneMass?: number;
}

export const ConflictType = {
  DUPLICATE_MEASUREMENT: 'duplicate_measurement',
  VALUE_MISMATCH: 'value_mismatch',
  TIMESTAMP_OVERLAP: 'timestamp_overlap',
} as const;
export type ConflictType = typeof ConflictType[keyof typeof ConflictType];

export interface DataConflict {
  readonly type: ConflictType;
  readonly existingEntry: {
    readonly id: string;
    readonly weight_kg: number;
    readonly logged_at: string;
    readonly source: string;
  };
  readonly timeDiff: number;
  readonly weightDiff: number;
  readonly severity: 'low' | 'medium' | 'high';
}

// Sync job database record types
export interface WithingsSyncJobRecord {
  readonly id: string;
  readonly connection_id: string;
  readonly inngest_event_id?: string;
  readonly job_type: string;
  readonly status: string;
  readonly start_date?: string;
  readonly end_date?: string;
  readonly measurements_requested: number;
  readonly measurements_processed: number;
  readonly measurements_synced: number;
  readonly measurements_skipped: number;
  readonly error_message?: string;
  readonly error_code?: string;
  readonly retry_count: number;
  readonly max_retries: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly completed_at?: string;
}

export interface WithingsDataConflictRecord {
  readonly id: string;
  readonly user_id: string;
  readonly sync_job_id?: string;
  readonly conflict_type: string;
  readonly withings_measurement_id: number;
  readonly existing_weight_log_id: string;
  readonly withings_data: Readonly<Record<string, unknown>>;
  readonly existing_data: Readonly<Record<string, unknown>>;
  readonly resolution_strategy?: string;
  readonly resolved_at?: string;
  readonly resolved_by?: string;
  readonly created_at: string;
}

export interface WithingsDeviceRecord {
  readonly id: string;
  readonly connection_id: string;
  readonly device_id: string;
  readonly device_model?: string;
  readonly device_type?: string;
  readonly battery_level?: number;
  readonly timezone?: string;
  readonly last_session_date?: string;
  readonly first_seen_at: string;
  readonly last_seen_at: string;
  readonly is_active: boolean;
}

// Phase 7.3: Webhook Types

export interface WithingsWebhookNotification {
  userid: string;
  appli: number;
  startdate: number;
  enddate: number;
  date: number;
}

export interface ProcessingResult {
  processed: number;
  synced: number;
  skipped: number;
}

export interface WithingsDevice {
  id: string;
  type: string;
  model: string;
  modelId?: number;
  batteryLevel?: number | string;
  timezone?: string;
  lastSessionDate?: Date;
  features: string[];
  lastSeenAt?: Date;
  notificationEnabled?: boolean;
}

export interface NotificationPayload {
  title: string;
  message: string;
  data?: {
    type: string;
    application?: number;
    synced_count?: number;
    [key: string]: unknown;
  };
}

export interface WithingsWebhookEventRecord {
  readonly id: string;
  readonly webhook_id: string;
  readonly user_id: string;
  readonly connection_id: string;
  readonly event_type: string;
  readonly application: number;
  readonly start_date: string;
  readonly end_date: string;
  readonly notification_date: string;
  readonly raw_payload: Readonly<Record<string, unknown>>;
  readonly processing_status: string;
  readonly processing_attempts: number;
  readonly max_attempts: number;
  readonly last_attempt_at?: string;
  readonly completed_at?: string;
  readonly error_message?: string;
  readonly created_at: string;
}

export interface WithingsNotificationPreferences {
  readonly id: string;
  readonly user_id: string;
  readonly measurement_notifications: boolean;
  readonly achievement_notifications: boolean;
  readonly sync_failure_notifications: boolean;
  readonly notification_methods: readonly string[];
  readonly quiet_hours_start?: string;
  readonly quiet_hours_end?: string;
  readonly timezone: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface UserNotificationToken {
  readonly id: string;
  readonly user_id: string;
  readonly token: string;
  readonly platform: string;
  readonly is_active: boolean;
  readonly last_used_at: string;
  readonly created_at: string;
}

export interface WithingsWebhookSubscription {
  readonly id: string;
  readonly connection_id: string;
  readonly withings_subscription_id?: string;
  readonly application: number;
  readonly callback_url: string;
  readonly comment?: string;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly expires_at?: string;
}
