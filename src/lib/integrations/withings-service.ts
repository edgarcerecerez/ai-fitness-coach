// High-level service layer for Withings integration
import { WithingsApiClient } from '../withings/client';
import { WithingsConnectionService } from '../withings/database';
import { 
  ConnectionStatus, 
  WithingsApiError,
  WithingsRateLimitError,
  WithingsMeasureResponseBody,
  WithingsUserInfoResponseBody 
} from '../withings/types';
import { apiLogger } from '../logger';

export class WithingsService {
  private readonly apiClient = new WithingsApiClient();
  private readonly connectionService = new WithingsConnectionService();

  /**
   * Get connection status for user
   */
  async getConnectionStatus(userId: string): Promise<ConnectionStatus> {
    try {
      const connection = await this.connectionService.getConnection(userId);

      const status: ConnectionStatus = {
        isConnected: !!connection && connection.isActive,
        connectedAt: connection?.connectedAt || undefined,
        lastSyncAt: connection?.lastSyncAt || undefined,
        withingsUserId: connection?.withingsUserId,
        scopes: connection?.scopes
      };

      apiLogger.debug('Retrieved connection status', {
        userId: userId.substring(0, 8) + '...',
        isConnected: status.isConnected
      });

      return status;
    } catch (error) {
      apiLogger.error('Failed to get connection status', { error, userId });
      throw new Error('Failed to get connection status');
    }
  }

  /**
   * Test if connection is working
   */
  async testConnection(userId: string): Promise<boolean> {
    try {
      const status = await this.getConnectionStatus(userId);
      
      if (!status.isConnected) {
        return false;
      }

      return await this.apiClient.testConnection(userId);
    } catch (error) {
      apiLogger.error('Connection test failed', { error, userId });
      return false;
    }
  }

  /**
   * Get user information from Withings
   */
  async getUserInfo(userId: string): Promise<WithingsUserInfoResponseBody> {
    try {
      const response = await this.apiClient.getUserInfo(userId);
      
      if (response.ok) {
        apiLogger.info('Successfully retrieved user info from Withings', {
          userId: userId.substring(0, 8) + '...',
          withingsUserId: response.body.userid
        });
        return response.body;
      }

      throw new WithingsApiError('Failed to get user info', response.status);
    } catch (error) {
      apiLogger.error('Failed to get user info from Withings', { error, userId });
      throw error;
    }
  }

  /**
   * Get weight measurements from Withings
   */
  async getWeightMeasurements(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): Promise<WithingsMeasureResponseBody> {
    try {
      const params: Record<string, unknown> = {
        meastype: '1', // Weight measurements
        category: '1'  // Real measurements (not user objectives)
      };

      if (options.startDate) {
        params.startdate = Math.floor(options.startDate.getTime() / 1000);
      }

      if (options.endDate) {
        params.enddate = Math.floor(options.endDate.getTime() / 1000);
      }

      if (options.limit) {
        params.limit = options.limit;
      }

      const response = await this.apiClient.getMeasurements(userId, params);

      if (response.ok) {
        // Update last sync time
        const connection = await this.connectionService.getConnection(userId);
        if (connection) {
          await this.connectionService.updateLastSyncTime(connection.id);
        }

        const measurementCount = response.body.measuregrps?.length ?? 0;
        apiLogger.info('Successfully retrieved weight measurements from Withings', {
          userId: userId.substring(0, 8) + '...',
          measurementCount,
          startDate: options.startDate?.toISOString(),
          endDate: options.endDate?.toISOString()
        });

        return response.body;
      }

      throw new WithingsApiError('Failed to get measurements', response.status);
    } catch (error) {
      apiLogger.error('Failed to get weight measurements from Withings', { 
        error, 
        userId,
        options 
      });
      throw error;
    }
  }

  /**
   * Get all body measurements (weight, BMI, body fat, etc.)
   */
  async getBodyMeasurements(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      measureTypes?: string[];
    } = {}
  ): Promise<WithingsMeasureResponseBody> {
    try {
      const params: Record<string, unknown> = {
        category: '1' // Real measurements
      };

      if (options.measureTypes && options.measureTypes.length > 0) {
        params.meastype = options.measureTypes.join(',');
      }

      if (options.startDate) {
        params.startdate = Math.floor(options.startDate.getTime() / 1000);
      }

      if (options.endDate) {
        params.enddate = Math.floor(options.endDate.getTime() / 1000);
      }

      if (options.limit) {
        params.limit = options.limit;
      }

      const response = await this.apiClient.getMeasurements(userId, params);

      if (response.ok) {
        // Update last sync time
        const connection = await this.connectionService.getConnection(userId);
        if (connection) {
          await this.connectionService.updateLastSyncTime(connection.id);
        }

        const measurementCount = response.body.measuregrps?.length ?? 0;
        apiLogger.info('Successfully retrieved body measurements from Withings', {
          userId: userId.substring(0, 8) + '...',
          measurementCount,
          measureTypes: options.measureTypes,
          startDate: options.startDate?.toISOString(),
          endDate: options.endDate?.toISOString()
        });

        return response.body;
      }

      throw new WithingsApiError('Failed to get body measurements', response.status);
    } catch (error) {
      apiLogger.error('Failed to get body measurements from Withings', { 
        error, 
        userId,
        options 
      });
      throw error;
    }
  }

  /**
   * Disconnect Withings account
   */
  async disconnectAccount(userId: string): Promise<void> {
    try {
      const connection = await this.connectionService.getConnection(userId);
      
      if (!connection || !connection.isActive) {
        apiLogger.warn('No active connection to disconnect', { userId });
        return;
      }

      // The connection service will handle token revocation and deactivation
      await this.connectionService.deactivateConnection(userId);

      apiLogger.info('Successfully disconnected Withings account', {
        userId: userId.substring(0, 8) + '...',
        connectionId: connection.id
      });
    } catch (error) {
      apiLogger.error('Failed to disconnect Withings account', { error, userId });
      throw error;
    }
  }

  /**
   * Get rate limit status for user
   */
  getRateLimitStatus(userId: string) {
    return this.apiClient.getRateLimitStatus(userId);
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error: unknown): boolean {
    if (error instanceof WithingsRateLimitError) {
      return true; // Can retry after rate limit resets
    }

    if (error instanceof WithingsApiError) {
      // Retry on temporary server errors
      return (error.status ?? 0) >= 500 && (error.status ?? 0) < 600;
    }

    // Network errors might be retryable
    type ErrorWithCode = { code?: unknown };
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as ErrorWithCode).code === 'network_error'
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get retry delay for retryable errors
   */
  getRetryDelay(error: unknown): number {
    if (error instanceof WithingsRateLimitError) {
      return error.retryAfter * 1000; // Convert to milliseconds
    }

    // Default exponential backoff: 1s, 2s, 4s, 8s, 16s
    return Math.min(1000 * Math.pow(2, Math.random() * 5), 16000);
  }

  /**
   * Sync data with retry logic
   */
  async syncDataWithRetry(
    userId: string,
    syncOperation: () => Promise<unknown>,
    maxRetries: number = 3
  ): Promise<unknown> {
    let lastError: unknown;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await syncOperation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries || !this.isRetryableError(error)) {
          throw error;
        }

        const delay = this.getRetryDelay(error);
        apiLogger.warn('Sync operation failed, retrying', {
          userId: userId.substring(0, 8) + '...',
          attempt,
          maxRetries,
          retryDelay: delay,
          error: error instanceof Error ? error.message : String(error)
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}
