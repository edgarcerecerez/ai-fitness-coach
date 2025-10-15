// OAuth 2.0 authentication service for Withings API
import crypto from 'crypto';
import { WithingsTokens, WithingsAuthConfig, AuthUrlResponse, WithingsAuthError } from './types';
import { apiLogger } from '../logger';

export class WithingsAuthService {
  private readonly config: WithingsAuthConfig;
  private readonly baseUrl = 'https://account.withings.com';
  private readonly tokenUrl = 'https://wbsapi.withings.net/v2/oauth2';

  constructor() {
    this.config = {
      clientId: process.env.WITHINGS_CLIENT_ID!,
      clientSecret: process.env.WITHINGS_CLIENT_SECRET!,
      redirectUri: process.env.WITHINGS_REDIRECT_URI!,
      scopes: ['user.info', 'user.metrics', 'user.activity']
    };

    // Validate required environment variables
    if (!this.config.clientId || !this.config.clientSecret || !this.config.redirectUri) {
      throw new Error('Missing required Withings OAuth configuration');
    }

    apiLogger.debug('WithingsAuthService initialized', {
      clientId: this.config.clientId.substring(0, 8) + '...',
      redirectUri: this.config.redirectUri,
      scopes: this.config.scopes
    });
  }

  /**
   * Generate OAuth 2.0 authorization URL with PKCE
   */
  generateAuthUrl(userId: string): AuthUrlResponse {
    try {
      const state = crypto.randomBytes(32).toString('hex');
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: this.config.clientId,
        redirect_uri: this.config.redirectUri,
        scope: this.config.scopes.join(','),
        state: `${userId}:${state}`,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      });

      const authUrl = `${this.baseUrl}/oauth2_user/authorize2?${params}`;
      
      apiLogger.info('Generated Withings auth URL', {
        userId: userId.substring(0, 8) + '...',
        scopes: this.config.scopes
      });
      
      return { authUrl, state, codeVerifier };
    } catch (error: unknown) {
      apiLogger.error('Failed to generate auth URL', { error, userId });
      throw new WithingsAuthError('Failed to generate authorization URL');
    }
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string
  ): Promise<WithingsTokens> {
    try {
      apiLogger.debug('Exchanging authorization code for tokens');

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'AI-Fitness-Coach/1.0'
        },
        body: new URLSearchParams({
          action: 'requesttoken',
          grant_type: 'authorization_code',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: this.config.redirectUri,
          code_verifier: codeVerifier
        })
      });

      const data = await response.json();
      
      if (!response.ok || data.status !== 0) {
        const errorMessage = data.error || `HTTP ${response.status}`;
        apiLogger.error('Token exchange failed', { 
          status: data.status, 
          error: errorMessage,
          httpStatus: response.status
        });
        throw new WithingsAuthError(`Token exchange failed: ${errorMessage}`);
      }

      const body = data.body;
      const tokens: WithingsTokens = {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        expiresAt: new Date(Date.now() + body.expires_in * 1000),
        userId: body.userid.toString(),
        scope: body.scope
      };

      apiLogger.info('Successfully exchanged code for tokens', {
        withingsUserId: tokens.userId,
        expiresAt: tokens.expiresAt.toISOString(),
        scopes: tokens.scope
      });

      return tokens;
    } catch (error: unknown) {
      if (error instanceof WithingsAuthError) {
        throw error;
      }
      
      apiLogger.error('Token exchange failed with unexpected error', { error });
      throw new WithingsAuthError('Token exchange failed due to network or server error');
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<WithingsTokens> {
    try {
      apiLogger.debug('Refreshing access token');

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'AI-Fitness-Coach/1.0'
        },
        body: new URLSearchParams({
          action: 'requesttoken',
          grant_type: 'refresh_token',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: refreshToken
        })
      });

      const data = await response.json();
      
      if (!response.ok || data.status !== 0) {
        const errorMessage = data.error || `HTTP ${response.status}`;
        apiLogger.error('Token refresh failed', { 
          status: data.status, 
          error: errorMessage,
          httpStatus: response.status
        });
        throw new WithingsAuthError(`Token refresh failed: ${errorMessage}`);
      }

      const body = data.body;
      const tokens: WithingsTokens = {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        expiresAt: new Date(Date.now() + body.expires_in * 1000),
        userId: body.userid.toString(),
        scope: body.scope
      };

      apiLogger.info('Successfully refreshed tokens', {
        withingsUserId: tokens.userId,
        expiresAt: tokens.expiresAt.toISOString(),
        scopes: tokens.scope
      });

      return tokens;
    } catch (error: unknown) {
      if (error instanceof WithingsAuthError) {
        throw error;
      }
      
      apiLogger.error('Token refresh failed with unexpected error', { error });
      throw new WithingsAuthError('Token refresh failed due to network or server error');
    }
  }

  /**
   * Revoke access token
   */
  async revokeToken(accessToken: string): Promise<void> {
    try {
      apiLogger.debug('Revoking access token');

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'AI-Fitness-Coach/1.0'
        },
        body: new URLSearchParams({
          action: 'revoke',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          token: accessToken
        })
      });

      const data = await response.json();
      
      if (!response.ok || data.status !== 0) {
        const errorMessage = data.error || `HTTP ${response.status}`;
        apiLogger.error('Token revocation failed', { 
          status: data.status, 
          error: errorMessage,
          httpStatus: response.status
        });
        throw new WithingsAuthError(`Token revocation failed: ${errorMessage}`);
      }

      apiLogger.info('Successfully revoked token');
    } catch (error: unknown) {
      if (error instanceof WithingsAuthError) {
        throw error;
      }
      
      apiLogger.error('Token revocation failed with unexpected error', { error });
      throw new WithingsAuthError('Token revocation failed due to network or server error');
    }
  }
}