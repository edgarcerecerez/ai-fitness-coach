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