// API client with rate limiting and automatic token refresh
import { 
  WithingsConnection, 
  WithingsApiResponse, 
  WithingsApiError,
  WithingsRateLimitError 
} from './types';
import { WithingsConnectionService } from './database';
import { WithingsAuthService } from './auth';
import { apiLogger } from '../logger';

interface RateLimitInfo {
  count: number;
  resetAt: number;
}

export class WithingsApiClient {
  private readonly baseUrl = 'https://wbsapi.withings.net';
  private readonly connectionService: WithingsConnectionService;
  private readonly authService: WithingsAuthService;

  constructor(
    connectionService?: WithingsConnectionService,
    authService?: WithingsAuthService
  ) {
    this.connectionService = connectionService ?? new WithingsConnectionService();
    this.authService = authService ?? new WithingsAuthService();
  }
  
  // Rate limiting: 120 requests per minute per user
  private readonly rateLimiter = new Map<string, RateLimitInfo>();
  private readonly maxRequestsPerMinute = 120;

  /**
   * Derive action parameter from endpoint
   */
  private deriveAction(endpoint: string): string {
    // More explicit endpoint to action mapping
    const actionMap: Record<string, string> = {
      '/v2/user': 'getinfo',
      '/v2/measure': 'getmeas',
      // Add other mappings as needed
    };
    return actionMap[endpoint] ?? endpoint.replace('/v2/', '').replace('/', '_');
  }

  /**
   * Make authenticated API request with automatic token refresh
   */
  async makeRequest(
    userId: string,
    endpoint: string,
    params: Record<string, unknown> = {},
    retryCount = 0
  ): Promise<WithingsApiResponse> {
    try {
      await this.checkRateLimit(userId);

      let connection = await this.connectionService.getConnection(userId);
      if (!connection) {
        throw new WithingsApiError('No active Withings connection found', 401);
      }

      // Check if token needs refresh (5 minute buffer)
      if (connection.expiresAt <= new Date(Date.now() + 5 * 60 * 1000)) {
        apiLogger.debug('Token needs refresh, refreshing...', {
          userId: userId.substring(0, 8) + '...',
          expiresAt: connection.expiresAt.toISOString()
        });
        connection = await this.refreshConnectionTokens(connection);
      }

      const requestParams = {
        ...params,
        action: params.action ?? this.deriveAction(endpoint)
      };

      apiLogger.debug('Making Withings API request', {
        endpoint,
        userId: userId.substring(0, 8) + '...',
        action: requestParams.action
      });

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${connection.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'AI-Fitness-Coach/1.0'
        },
        body: new URLSearchParams(requestParams)
      });

      const data = await response.json();

      // Handle token expiry with retry
      if (response.status === 401 && retryCount === 0) {
        apiLogger.debug('Got 401, attempting token refresh and retry', {
          userId: userId.substring(0, 8) + '...'
        });
        connection = await this.refreshConnectionTokens(connection);
        return this.makeRequest(userId, endpoint, params, retryCount + 1);
      }

      if (!response.ok) {
        const error = new WithingsApiError(
          data.error || `HTTP ${response.status}`,
          response.status,
          data.code
        );
        apiLogger.error('Withings API request failed', {
          endpoint,
          status: response.status,
          error: data.error,
          code: data.code
        });
        throw error;
      }

      if (data.status !== 0) {
        const error = new WithingsApiError(
          data.error || 'Unknown API error',
          data.status,
          data.code
        );
        apiLogger.error('Withings API returned error status', {
          endpoint,
          status: data.status,
          error: data.error,
          code: data.code
        });
        throw error;
      }

      this.updateRateLimit(userId);

      apiLogger.debug('Withings API request successful', {
        endpoint,
        userId: userId.substring(0, 8) + '...'
      });

      return data;
    } catch (error) {
      if (error instanceof WithingsApiError || error instanceof WithingsRateLimitError) {
        throw error;
      }
      
      apiLogger.error('Unexpected error in Withings API request', {
        endpoint,
        error,
        userId: userId.substring(0, 8) + '...'
      });
      
      throw new WithingsApiError(
        'Network or server error occurred',
        0,
        'network_error'
      );
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(userId: string): Promise<WithingsApiResponse> {
    return this.makeRequest(userId, '/v2/user');
  }

  /**
   * Get user body measurements (weight, BMI, etc.)
   */
  async getMeasurements(
    userId: string, 
    options: {
      meastype?: string;
      category?: number;
      startdate?: number;
      enddate?: number;
      limit?: number;
    } = {}
  ): Promise<WithingsApiResponse> {
    return this.makeRequest(userId, '/v2/measure', { 
      ...options
    });
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimit(userId: string): Promise<void> {
    const now = Date.now();
    const userLimit = this.rateLimiter.get(userId);

    if (!userLimit || now > userLimit.resetAt) {
      this.rateLimiter.set(userId, { 
        count: 0, 
        resetAt: now + 60000 // 1 minute
      });
      return;
    }

    if (userLimit.count >= this.maxRequestsPerMinute) {
      const waitTime = userLimit.resetAt - now;
      const waitTimeSeconds = Math.ceil(waitTime / 1000);
      
      apiLogger.warn('Rate limit exceeded for user', {
        userId: userId.substring(0, 8) + '...',
        count: userLimit.count,
        waitTimeSeconds
      });
      
      throw new WithingsRateLimitError(
        `Rate limit exceeded. Try again in ${waitTimeSeconds} seconds`,
        waitTimeSeconds
      );
    }
  }

  /**
   * Update rate limit counter
   */
  private updateRateLimit(userId: string): void {
    const userLimit = this.rateLimiter.get(userId);
    if (userLimit) {
      userLimit.count++;
      
      apiLogger.debug('Updated rate limit', {
        userId: userId.substring(0, 8) + '...',
        count: userLimit.count,
        remaining: this.maxRequestsPerMinute - userLimit.count
      });
    }
  }

  /**
   * Refresh connection tokens
   */
  private async refreshConnectionTokens(connection: WithingsConnection): Promise<WithingsConnection> {
    try {
      apiLogger.debug('Refreshing connection tokens', {
        connectionId: connection.id,
        userId: connection.userId.substring(0, 8) + '...'
      });

      const newTokens = await this.authService.refreshToken(connection.refreshToken);
      await this.connectionService.updateTokens(connection.id, newTokens);
      
      const refreshedConnection: WithingsConnection = {
        ...connection,
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresAt: newTokens.expiresAt,
        lastTokenRefreshAt: new Date(),
        refreshFailureCount: 0
      };

      apiLogger.info('Successfully refreshed connection tokens', {
        connectionId: connection.id,
        expiresAt: newTokens.expiresAt.toISOString()
      });

      return refreshedConnection;
    } catch (error) {
      apiLogger.warn('Failed to refresh connection tokens', {
        connectionId: connection.id,
        error
      });

      // Increment failure count
      await this.connectionService.incrementRefreshFailureCount(connection.id);

      // If too many failures, deactivate connection
      if (connection.refreshFailureCount >= 3) {
        apiLogger.warn('Too many refresh failures, deactivating connection', {
          connectionId: connection.id,
          failureCount: connection.refreshFailureCount + 1
        });
        await this.connectionService.deactivateConnection(connection.userId);
      }

      throw new WithingsApiError(
        'Failed to refresh tokens. Please reconnect your Withings account.',
        401,
        'token_refresh_failed'
      );
    }
  }

  /**
   * Test connection by making a simple API call
   */
  async testConnection(userId: string): Promise<boolean> {
    try {
      await this.getUserInfo(userId);
      
      apiLogger.info('Connection test successful', {
        userId: userId.substring(0, 8) + '...'
      });
      
      return true;
    } catch (error) {
      apiLogger.warn('Connection test failed', {
        userId: userId.substring(0, 8) + '...',
        error
      });
      
      return false;
    }
  }

  /**
   * Get current rate limit status for user
   */
  getRateLimitStatus(userId: string): { 
    remaining: number; 
    resetAt: Date; 
    resetIn: number; 
  } {
    const userLimit = this.rateLimiter.get(userId);
    
    if (!userLimit) {
      return {
        remaining: this.maxRequestsPerMinute,
        resetAt: new Date(Date.now() + 60000),
        resetIn: 60
      };
    }

    const remaining = Math.max(0, this.maxRequestsPerMinute - userLimit.count);
    const resetIn = Math.max(0, Math.ceil((userLimit.resetAt - Date.now()) / 1000));

    return {
      remaining,
      resetAt: new Date(userLimit.resetAt),
      resetIn
    };
  }
}