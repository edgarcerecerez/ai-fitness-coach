// TypeScript interfaces for Withings integration

export interface WithingsAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface WithingsTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  userId: string;
  scope: string;
}

export interface WithingsConnection {
  id: string;
  userId: string;
  withingsUserId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
  isActive: boolean;
  lastSyncAt: Date | null;
  connectedAt: Date;
  lastTokenRefreshAt?: Date;
  refreshFailureCount: number;
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
  authUrl: string;
  state: string;
  codeVerifier: string;
}

// API response types
export interface WithingsApiResponse<T = unknown> {
  status: number;
  body?: T;
  error?: string;
}

// Connection status types
export interface ConnectionStatus {
  isConnected: boolean;
  connectedAt?: Date;
  lastSyncAt?: Date;
  withingsUserId?: string;
  scopes?: string[];
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
  id: string;
  groupId: number;
  type: number;
  value: number;
  unit: number;
  timestamp: Date;
  deviceId?: string;
  category?: number;
  comment?: string;
}

export interface SyncJobOptions {
  jobType?: 'manual' | 'webhook' | 'scheduled' | 'historical';
  startDate?: Date;
  endDate?: Date;
  lastUpdate?: Date;
  measurementTypes?: string[];
  batchSize?: number;
}

export interface SyncResult {
  processed: number;
  synced: number;
  skipped: number;
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

export enum ConflictType {
  DUPLICATE_MEASUREMENT = 'duplicate_measurement',
  VALUE_MISMATCH = 'value_mismatch',
  TIMESTAMP_OVERLAP = 'timestamp_overlap'
}

export interface DataConflict {
  type: ConflictType;
  existingEntry: {
    readonly id: string;
    readonly weight_kg: number;
    readonly logged_at: string;
    readonly source: string;
  };
  timeDiff: number;
  weightDiff: number;
  severity: 'low' | 'medium' | 'high';
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