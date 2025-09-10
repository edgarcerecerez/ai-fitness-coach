// Unit tests for Withings API client
import { WithingsApiClient } from '../client';
import { WithingsConnectionService } from '../database';
import { WithingsAuthService } from '../auth';
import { WithingsApiError, WithingsRateLimitError } from '../types';

// Mock dependencies
jest.mock('../database');
jest.mock('../auth');

describe('WithingsApiClient', () => {
  let apiClient: WithingsApiClient;
  let mockConnectionService: jest.Mocked<WithingsConnectionService>;
  let mockAuthService: jest.Mocked<WithingsAuthService>;

  const mockConnection = {
    id: 'conn123',
    userId: 'user123',
    withingsUserId: 'withings123',
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    scopes: ['user.info', 'user.metrics'],
    isActive: true,
    connectedAt: new Date(),
    lastSyncAt: null,
    refreshFailureCount: 0
  };

  beforeEach(() => {
    mockConnectionService = new WithingsConnectionService() as jest.Mocked<WithingsConnectionService>;
    mockAuthService = new WithingsAuthService() as jest.Mocked<WithingsAuthService>;
    
    // Use dependency injection for testability
    apiClient = new WithingsApiClient(mockConnectionService, mockAuthService);

    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('makeRequest', () => {
    it('should make successful API request', async () => {
      mockConnectionService.getConnection.mockResolvedValue(mockConnection);
      
      const mockResponse = {
        status: 0,
        body: { data: 'test_data' }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiClient.makeRequest('user123', '/v2/user', { action: 'getinfo' });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://wbsapi.withings.net/v2/user',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer access_token',
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      );
    });

    it('should throw error if no connection found', async () => {
      mockConnectionService.getConnection.mockResolvedValue(null);

      await expect(
        apiClient.makeRequest('user123', '/v2/user')
      ).rejects.toThrow('No active Withings connection found');
    });

    it('should refresh token if expiring soon', async () => {
      const expiringConnection = {
        ...mockConnection,
        expiresAt: new Date(Date.now() + 2 * 60 * 1000) // 2 minutes from now (within 5 min buffer)
      };

      const refreshedConnection = {
        ...expiringConnection,
        accessToken: 'new_access_token',
        expiresAt: new Date(Date.now() + 3600000)
      };

      mockConnectionService.getConnection.mockResolvedValue(expiringConnection);
      mockAuthService.refreshToken.mockResolvedValue({
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresAt: new Date(Date.now() + 3600000),
        userId: 'withings123',
        scope: 'user.info,user.metrics'
      });
      mockConnectionService.updateTokens.mockResolvedValue(undefined);

      const mockResponse = { status: 0, body: { data: 'test_data' } };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await apiClient.makeRequest('user123', '/v2/user');

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('refresh_token');
      expect(mockConnectionService.updateTokens).toHaveBeenCalled();
    });

    it('should retry on 401 with token refresh', async () => {
      mockConnectionService.getConnection
        .mockResolvedValueOnce(mockConnection)
        .mockResolvedValueOnce(mockConnection);
      
      mockAuthService.refreshToken.mockResolvedValue({
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresAt: new Date(Date.now() + 3600000),
        userId: 'withings123',
        scope: 'user.info,user.metrics'
      });

      // First request returns 401, second succeeds
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ status: 401, error: 'invalid_token' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 0, body: { data: 'success' } })
        });

      const result = await apiClient.makeRequest('user123', '/v2/user');

      expect(result.body.data).toBe('success');
      expect(mockAuthService.refreshToken).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle API error responses', async () => {
      mockConnectionService.getConnection.mockResolvedValue(mockConnection);

      const errorResponse = {
        status: 2555,
        error: 'Invalid parameters'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(
        apiClient.makeRequest('user123', '/v2/user')
      ).rejects.toThrow('Invalid parameters');
    });

    it('should handle HTTP error responses', async () => {
      mockConnectionService.getConnection.mockResolvedValue(mockConnection);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' })
      });

      await expect(
        apiClient.makeRequest('user123', '/v2/user')
      ).rejects.toThrow('Server error');
    });
  });

  describe('rate limiting', () => {
    beforeEach(() => {
      mockConnectionService.getConnection.mockResolvedValue(mockConnection);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 0, body: {} })
      });
    });

    it('should allow requests within rate limit', async () => {
      // Make multiple requests within limit
      for (let i = 0; i < 5; i++) {
        await apiClient.makeRequest('user123', '/v2/user');
      }

      expect(global.fetch).toHaveBeenCalledTimes(5);
    });

    it('should enforce rate limit', async () => {
      // Mock rate limiter to be at limit
      const rateLimiter = new Map();
      rateLimiter.set('user123', { count: 120, resetAt: Date.now() + 60000 });
      (apiClient as any).rateLimiter = rateLimiter;

      await expect(
        apiClient.makeRequest('user123', '/v2/user')
      ).rejects.toThrow(WithingsRateLimitError);
    });

    it('should reset rate limit after time window', async () => {
      // Set expired rate limit
      const rateLimiter = new Map();
      rateLimiter.set('user123', { count: 120, resetAt: Date.now() - 1000 });
      (apiClient as any).rateLimiter = rateLimiter;

      await apiClient.makeRequest('user123', '/v2/user');

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('getUserInfo', () => {
    it('should call correct endpoint', async () => {
      mockConnectionService.getConnection.mockResolvedValue(mockConnection);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 0, body: { userid: '123' } })
      });

      await apiClient.getUserInfo('user123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://wbsapi.withings.net/v2/user',
        expect.objectContaining({
          body: expect.stringContaining('action=getinfo')
        })
      );
    });
  });

  describe('getMeasurements', () => {
    beforeEach(() => {
      mockConnectionService.getConnection.mockResolvedValue(mockConnection);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 0, body: { measuregrps: [] } })
      });
    });

    it('should call correct endpoint with default params', async () => {
      await apiClient.getMeasurements('user123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://wbsapi.withings.net/v2/measure',
        expect.objectContaining({
          body: expect.stringContaining('action=getmeas')
        })
      );
    });

    it('should include optional parameters', async () => {
      const options = {
        meastype: '1,6',
        startdate: 1234567890,
        enddate: 1234567999,
        limit: 100
      };

      await apiClient.getMeasurements('user123', options);

      const body = (global.fetch as jest.Mock).mock.calls[0][1].body;
      expect(body).toContain('meastype=1%2C6');
      expect(body).toContain('startdate=1234567890');
      expect(body).toContain('enddate=1234567999');
      expect(body).toContain('limit=100');
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection', async () => {
      mockConnectionService.getConnection.mockResolvedValue(mockConnection);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 0, body: { userid: '123' } })
      });

      const result = await apiClient.testConnection('user123');
      expect(result).toBe(true);
    });

    it('should return false for failed connection', async () => {
      mockConnectionService.getConnection.mockResolvedValue(mockConnection);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ status: 401, error: 'Unauthorized' })
      });

      const result = await apiClient.testConnection('user123');
      expect(result).toBe(false);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return default status for new user', () => {
      const status = apiClient.getRateLimitStatus('new_user');
      
      expect(status.remaining).toBe(120);
      expect(status.resetAt).toBeInstanceOf(Date);
      expect(status.resetIn).toBe(60);
    });

    it('should return correct status for user with usage', () => {
      const rateLimiter = new Map();
      const resetAt = Date.now() + 30000; // 30 seconds from now
      rateLimiter.set('user123', { count: 50, resetAt });
      (apiClient as any).rateLimiter = rateLimiter;

      const status = apiClient.getRateLimitStatus('user123');
      
      expect(status.remaining).toBe(70); // 120 - 50
      expect(status.resetAt.getTime()).toBe(resetAt);
      expect(status.resetIn).toBe(30);
    });
  });
});