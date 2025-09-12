// Database service layer for Withings connections
import { createClient } from '@/utils/supabase/server';
import { encryptToken, decryptToken } from './crypto';
import { 
  WithingsTokens, 
  WithingsConnection,
  WithingsAuthStateRecord
} from './types';
import { dbLogger } from '../logger';

export class WithingsConnectionService {

  /**
   * Store encrypted connection tokens
   */
  async storeConnection(
    userId: string, 
    tokens: WithingsTokens
  ): Promise<string> {
    try {
      dbLogger.debug('Storing new Withings connection', {
        userId: userId.substring(0, 8) + '...',
        withingsUserId: tokens.userId,
        scopes: tokens.scope.split(/[,\s]+/)
      });

      const encryptedAccessToken = encryptToken(tokens.accessToken);
      const encryptedRefreshToken = encryptToken(tokens.refreshToken);

      const supabase = await createClient();
      const { data, error } = await supabase
        .from('withings_connections')
        .insert({
          user_id: userId,
          withings_user_id: tokens.userId,
          access_token_encrypted: JSON.stringify(encryptedAccessToken),
          refresh_token_encrypted: JSON.stringify(encryptedRefreshToken),
          token_expires_at: tokens.expiresAt.toISOString(),
          scopes: tokens.scope.split(/[,\s]+/).filter(scope => scope.trim()),
          connected_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        dbLogger.error('Failed to store Withings connection', { error, userId });
        throw new Error(`Failed to store connection: ${error.message}`);
      }

      // Log connection event
      await this.logConnectionEvent(data.id, 'connected', {
        withings_user_id: tokens.userId,
        scopes: tokens.scope.split(/[,\s]+/).filter(scope => scope.trim())
      });

      dbLogger.info('Successfully stored Withings connection', {
        connectionId: data.id,
        userId: userId.substring(0, 8) + '...',
        withingsUserId: tokens.userId
      });

      return data.id;
    } catch (error) {
      dbLogger.error('Failed to store connection', { error, userId });
      throw error;
    }
  }

  /**
   * Get connection for user
   */
  async getConnection(userId: string): Promise<WithingsConnection | null> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('withings_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return null;
        }
        dbLogger.error('Failed to get Withings connection', { error, userId });
        throw new Error(`Failed to get connection: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      const accessTokenData = JSON.parse(data.access_token_encrypted);
      const refreshTokenData = JSON.parse(data.refresh_token_encrypted);

      const connection: WithingsConnection = {
        id: data.id,
        userId: data.user_id,
        withingsUserId: data.withings_user_id,
        accessToken: decryptToken(accessTokenData),
        refreshToken: decryptToken(refreshTokenData),
        expiresAt: new Date(data.token_expires_at),
        scopes: data.scopes,
        isActive: data.is_active,
        connectedAt: new Date(data.connected_at),
        lastSyncAt: data.last_sync_at ? new Date(data.last_sync_at) : null,
        lastTokenRefreshAt: data.last_token_refresh_at ? new Date(data.last_token_refresh_at) : undefined,
        refreshFailureCount: data.refresh_failure_count
      };

      dbLogger.debug('Retrieved Withings connection', {
        connectionId: connection.id,
        userId: userId.substring(0, 8) + '...',
        withingsUserId: connection.withingsUserId,
        expiresAt: connection.expiresAt.toISOString()
      });

      return connection;
    } catch (error) {
      dbLogger.error('Failed to get connection', { error, userId });
      throw error;
    }
  }

  /**
   * Update connection tokens
   */
  async updateTokens(
    connectionId: string,
    tokens: WithingsTokens
  ): Promise<void> {
    try {
      dbLogger.debug('Updating Withings connection tokens', {
        connectionId,
        expiresAt: tokens.expiresAt.toISOString()
      });

      const encryptedAccessToken = encryptToken(tokens.accessToken);
      const encryptedRefreshToken = encryptToken(tokens.refreshToken);

      const supabase = await createClient();
      const { error } = await supabase
        .from('withings_connections')
        .update({
          access_token_encrypted: JSON.stringify(encryptedAccessToken),
          refresh_token_encrypted: JSON.stringify(encryptedRefreshToken),
          token_expires_at: tokens.expiresAt.toISOString(),
          last_token_refresh_at: new Date().toISOString(),
          refresh_failure_count: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', connectionId);

      if (error) {
        dbLogger.error('Failed to update tokens', { error, connectionId });
        throw new Error(`Failed to update tokens: ${error.message}`);
      }

      await this.logConnectionEvent(connectionId, 'token_refreshed');

      dbLogger.info('Successfully updated connection tokens', {
        connectionId,
        expiresAt: tokens.expiresAt.toISOString()
      });
    } catch (error) {
      dbLogger.error('Failed to update tokens', { error, connectionId });
      throw error;
    }
  }

  /**
   * Increment refresh failure count
   */
  async incrementRefreshFailureCount(connectionId: string): Promise<void> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('withings_connections')
        .update({
          refresh_failure_count: supabase.rpc('increment_refresh_failure_count'),
          updated_at: new Date().toISOString()
        })
        .eq('id', connectionId);

      if (error) {
        dbLogger.error('Failed to increment refresh failure count', { error, connectionId });
      }
    } catch (error) {
      dbLogger.error('Failed to increment refresh failure count', { error, connectionId });
    }
  }

  /**
   * Deactivate connection
   */
  async deactivateConnection(userId: string): Promise<void> {
    try {
      dbLogger.debug('Deactivating Withings connection', {
        userId: userId.substring(0, 8) + '...'
      });

      const supabase = await createClient();
      const { error } = await supabase
        .from('withings_connections')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        dbLogger.error('Failed to deactivate connection', { error, userId });
        throw new Error(`Failed to deactivate connection: ${error.message}`);
      }

      // Get connection ID for logging
      const { data } = await supabase
        .from('withings_connections')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (data) {
        await this.logConnectionEvent(data.id, 'disconnected');
      }

      dbLogger.info('Successfully deactivated Withings connection', {
        userId: userId.substring(0, 8) + '...'
      });
    } catch (error) {
      dbLogger.error('Failed to deactivate connection', { error, userId });
      throw error;
    }
  }

  /**
   * Store OAuth auth state
   */
  async storeAuthState(
    state: string,
    userId: string,
    codeVerifier: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('withings_auth_states')
        .insert({
          state,
          user_id: userId,
          code_verifier: codeVerifier,
          expires_at: expiresAt.toISOString()
        });

      if (error) {
        dbLogger.error('Failed to store auth state', { error, userId });
        throw new Error(`Failed to store auth state: ${error.message}`);
      }

      dbLogger.debug('Stored OAuth auth state', {
        userId: userId.substring(0, 8) + '...',
        expiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      dbLogger.error('Failed to store auth state', { error, userId });
      throw error;
    }
  }

  /**
   * Get and consume OAuth auth state
   */
  async getAndConsumeAuthState(state: string): Promise<WithingsAuthStateRecord | null> {
    try {
      const supabase = await createClient();
      // Get auth state
      const { data, error } = await supabase
        .from('withings_auth_states')
        .select('*')
        .eq('state', state)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        dbLogger.error('Failed to get auth state', { error, state });
        throw new Error(`Failed to get auth state: ${error.message}`);
      }

      // Delete auth state (consume it)
      await supabase
        .from('withings_auth_states')
        .delete()
        .eq('state', state);

      dbLogger.debug('Retrieved and consumed OAuth auth state', {
        userId: data.user_id.substring(0, 8) + '...'
      });

      return data;
    } catch (error) {
      dbLogger.error('Failed to get and consume auth state', { error, state });
      throw error;
    }
  }

  /**
   * Clean up expired auth states
   */
  async cleanupExpiredAuthStates(): Promise<void> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('withings_auth_states')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        dbLogger.error('Failed to cleanup expired auth states', { error });
      } else {
        dbLogger.debug('Cleaned up expired OAuth auth states');
      }
    } catch (error) {
      dbLogger.error('Failed to cleanup expired auth states', { error });
    }
  }

  /**
   * Update last sync time
   */
  async updateLastSyncTime(connectionId: string): Promise<void> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('withings_connections')
        .update({
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', connectionId);

      if (error) {
        dbLogger.error('Failed to update last sync time', { error, connectionId });
      }
    } catch (error) {
      dbLogger.error('Failed to update last sync time', { error, connectionId });
    }
  }

  /**
   * Log connection event
   */
  private async logConnectionEvent(
    connectionId: string,
    eventType: string,
    eventData?: Record<string, unknown>
  ): Promise<void> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('withings_connection_events')
        .insert({
          connection_id: connectionId,
          event_type: eventType,
          event_data: eventData || {}
        });

      if (error) {
        dbLogger.error('Failed to log connection event', { 
          error, 
          connectionId, 
          eventType 
        });
      }
    } catch (error) {
      dbLogger.error('Failed to log connection event', { 
        error, 
        connectionId, 
        eventType 
      });
    }
  }
}