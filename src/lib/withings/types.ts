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
  comment?: string;
  measures: Array<{
    value: number;
    type: number;
    unit: number;
    algo?: number;
    fm?: number;
  }>;
}

export interface WithingsMeasureResponseBody {
  measuregrps?: WithingsMeasureGroup[];
  more?: number;
  offset?: number;
  updatetime?: number;
}

export interface WithingsUserInfoResponseBody {
  userid?: number | string;
  users?: Array<{
    id: number;
    firstname?: string;
    lastname?: string;
    shortname?: string;
    gender?: number;
    birthdate?: number;
  }>;
}

export interface WithingsDeviceApiItem {
  deviceid: string;
  type: number;
  model: string;
  model_id?: number;
  battery?: number | string | null;
  timezone?: string;
  last_session_date?: number;
}

export interface WithingsDeviceListResponse {
  devices?: WithingsDeviceApiItem[];
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

// Client helpers throw on API failure, so downstream code always sees success.
export type WithingsApiResponse<T = unknown> = WithingsApiSuccess<T>;

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
  measurements_processed: number;
  measurements_synced: number;
  measurements_skipped: number;
}

export interface ProcessedMeasurement {
  weight?: number;
  height?: number;
  fatFreeMass?: number;
  bodyFat?: number;
  fatMass?: number;
  muscleMass?: number;
  hydration?: number;
  boneMass?: number;
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
  id: string;
  user_id: string;
  measurement_notifications: boolean;
  achievement_notifications: boolean;
  sync_failure_notifications: boolean;
  notification_methods: string[];
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
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

// Phase 7.4: Advanced analytics & insights types

export interface BodyCompositionData {
  readonly weight_kg: number;
  readonly body_fat_percentage?: number | null;
  readonly muscle_mass_kg?: number | null;
  readonly bone_mass_kg?: number | null;
  readonly water_percentage?: number | null;
  readonly visceral_fat_level?: number | null;
  readonly measurement_quality_score?: number | null;
  readonly data_completeness_score?: number | null;
}

export type GenderIdentity = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface BiometricProfile {
  readonly age: number;
  readonly gender: GenderIdentity;
  readonly height_m: number;
  readonly activity_level?: string | null;
}

export interface HydrationAssessment {
  readonly level: 'Optimal' | 'Adequate' | 'Dehydrated' | 'Unknown';
  readonly value: number | null;
  readonly recommendedRange?: {
    readonly min: number;
    readonly max: number;
  };
  readonly recommendation?: string;
}

export interface HealthMetrics {
  readonly bmi: {
    readonly value: number;
    readonly category: string;
    readonly health_risk: string;
  };
  readonly bodyFatMass: number | null;
  readonly leanBodyMass: number | null;
  readonly metabolicAge?: number | null;
  readonly visceralFatLevel?: number | null;
  readonly healthyWeightRange: {
    readonly min: number;
    readonly max: number;
  };
  readonly targetBodyFatRange: {
    readonly min: number;
    readonly max: number;
  };
  readonly muscleFatRatio?: number | null;
  readonly boneDensityIndicator?: number | null;
  readonly hydrationStatus?: HydrationAssessment | null;
  readonly weightKg?: number;
  readonly bodyFatPercentage?: number | null;
  readonly muscleMassKg?: number | null;
}

export type TrendPeriod = 'weekly' | 'monthly' | 'quarterly';
export type MetricType = 'weight' | 'body_fat' | 'muscle_mass' | 'bmi';
export type TrendDirection = 'up' | 'down' | 'stable';
export type HealthImpact = 'positive' | 'negative' | 'neutral';

export interface TrendAnalysis {
  readonly userId: string;
  readonly metricType: MetricType;
  readonly trendPeriod: TrendPeriod;
  readonly analysisDate: Date;
  readonly startValue: number;
  readonly endValue: number;
  readonly changeAbsolute: number;
  readonly changePercentage: number;
  readonly trendDirection: TrendDirection;
  readonly trendStrength: number;
  readonly dataPointsCount: number;
  readonly standardDeviation: number;
  readonly correlationCoefficient: number;
  readonly rSquared: number;
  readonly healthImpact: HealthImpact;
  readonly confidenceLevel: number;
}

export type InsightType = 'recommendation' | 'pattern' | 'alert' | 'achievement';
export type InsightImportance = 'low' | 'medium' | 'high' | 'critical';

export interface AIInsight {
  readonly type: InsightType;
  readonly category:
    | 'weight_loss'
    | 'muscle_gain'
    | 'health_risk'
    | 'progress'
    | 'body_composition'
    | 'health_improvement';
  readonly title: string;
  readonly description: string;
  readonly actionItems?: readonly string[];
  readonly triggerData: Readonly<Record<string, unknown>>;
  readonly confidenceScore: number;
  readonly importanceLevel: InsightImportance;
  readonly expiresAt?: Date | null;
}

export type ExportType = 'full' | 'date_range' | 'specific_metrics';
export type ExportFormat = 'json' | 'csv' | 'pdf';

export interface ExportDateRange {
  readonly startDate: Date;
  readonly endDate: Date;
}

export interface ExportRequest {
  readonly exportType: ExportType;
  readonly format: ExportFormat;
  readonly dateRange?: ExportDateRange;
  readonly includedMetrics?: readonly string[];
}

export interface WithingsDataExportRecord {
  readonly id: string;
  readonly user_id: string;
  readonly export_type: ExportType;
  readonly export_format: ExportFormat;
  readonly date_range_start?: string | null;
  readonly date_range_end?: string | null;
  readonly included_metrics?: string[] | null;
  readonly status: string;
  readonly file_path?: string | null;
  readonly file_size_bytes?: number | null;
  readonly download_url?: string | null;
  readonly expires_at?: string | null;
  readonly compliance_flags?: Record<string, unknown> | null;
  readonly access_log?: Record<string, unknown> | null;
  readonly created_at: string;
  readonly completed_at?: string | null;
}

export interface HealthGoal {
  readonly id: string;
  readonly user_id: string;
  readonly goal_type: 'weight_loss' | 'weight_gain' | 'body_fat_reduction' | 'muscle_gain';
  readonly metric_type: 'weight' | 'body_fat_percentage' | 'muscle_mass_kg';
  readonly target_value: number;
  readonly current_value?: number | null;
  readonly start_value: number;
  readonly target_date?: string | null;
  readonly progress_percentage: number;
  readonly is_on_track: boolean;
  readonly estimated_completion_date?: string | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly completed_at?: string | null;
}

export interface GoalProgress {
  readonly progressPercentage: number;
  readonly isOnTrack: boolean;
  readonly estimatedCompletionDate?: Date | null;
}
