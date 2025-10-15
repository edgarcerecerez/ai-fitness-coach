// Unit tests for Withings authentication service
import { WithingsAuthService } from '../auth';

// Mock environment variables
const mockEnv = {
  WITHINGS_CLIENT_ID: 'test_client_id',
  WITHINGS_CLIENT_SECRET: 'test_client_secret', 
  WITHINGS_REDIRECT_URI: 'http://localhost:3000/callback'
};

type FetchMock = jest.MockedFunction<typeof fetch>;

const installFetchMock = () => {
  const originalFetch = global.fetch;
  // @ts-expect-error In the test environment we intentionally override the global fetch implementation.
  global.fetch = jest.fn() as unknown as typeof fetch;

  const restore = () => {
    // @ts-expect-error Restore the original fetch after the test completes.
    global.fetch = originalFetch;
  };

  return {
    mock: global.fetch as unknown as FetchMock,
    restore,
  };
};

describe('WithingsAuthService', () => {
  let authService: WithingsAuthService;
  const originalEnv = process.env;

  beforeEach(() => {
    // Mock environment variables
    process.env = { ...originalEnv, ...mockEnv };
    authService = new WithingsAuthService();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(authService).toBeInstanceOf(WithingsAuthService);
    });

    it('should throw error if required environment variables are missing', () => {
      delete process.env.WITHINGS_CLIENT_ID;
      expect(() => new WithingsAuthService()).toThrow('Missing required Withings OAuth configuration');
    });
  });

  describe('generateAuthUrl', () => {
    it('should generate valid auth URL with PKCE', () => {
      const userId = 'user123';
      const { authUrl, state, codeVerifier } = authService.generateAuthUrl(userId);
      
      expect(authUrl).toContain('account.withings.com');
      expect(authUrl).toContain('oauth2_user/authorize2');
      expect(authUrl).toContain('code_challenge=');
      expect(authUrl).toContain('code_challenge_method=S256');
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain(`client_id=${mockEnv.WITHINGS_CLIENT_ID}`);
      expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(mockEnv.WITHINGS_REDIRECT_URI)}`);
      expect(authUrl).toContain('scope=user.info%2Cuser.metrics%2Cuser.activity');
      
      expect(state).toBeDefined();
      expect(state).toHaveLength(64); // 32 bytes as hex = 64 characters
      expect(codeVerifier).toBeDefined();
      expect(authUrl).toContain(`state=${userId}%3A${state}`);
    });

    it('should generate unique state and code verifier for each call', () => {
      const userId = 'user123';
      const first = authService.generateAuthUrl(userId);
      const second = authService.generateAuthUrl(userId);
      
      expect(first.state).not.toBe(second.state);
      expect(first.codeVerifier).not.toBe(second.codeVerifier);
      expect(first.authUrl).not.toBe(second.authUrl);
    });
  });

  describe('exchangeCodeForTokens', () => {
    let fetchController: ReturnType<typeof installFetchMock>;

    beforeEach(() => {
      fetchController = installFetchMock();
    });

    afterEach(() => {
      jest.restoreAllMocks();
      fetchController.restore();
    });

    it('should successfully exchange code for tokens', async () => {
      const mockResponse = {
        status: 0,
        body: {
          access_token: 'test_access_token',
          refresh_token: 'test_refresh_token',
          expires_in: 3600,
          userid: '12345',
          scope: 'user.info,user.metrics'
        }
      };

      fetchController.mock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const tokens = await authService.exchangeCodeForTokens('test_code', 'test_verifier');

      expect(tokens.accessToken).toBe('test_access_token');
      expect(tokens.refreshToken).toBe('test_refresh_token');
      expect(tokens.userId).toBe('12345');
      expect(tokens.scope).toBe('user.info,user.metrics');
      expect(tokens.expiresAt).toBeInstanceOf(Date);
    });

    it('should handle API error response', async () => {
      const mockResponse = {
        status: 401,
        error: 'invalid_grant'
      };

      fetchController.mock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await expect(
        authService.exchangeCodeForTokens('invalid_code', 'test_verifier')
      ).rejects.toThrow('Token exchange failed: invalid_grant');
    });

    it('should handle network error', async () => {
      fetchController.mock.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        authService.exchangeCodeForTokens('test_code', 'test_verifier')
      ).rejects.toThrow('Token exchange failed due to network or server error');
    });
  });

  describe('refreshToken', () => {
    let fetchController: ReturnType<typeof installFetchMock>;

    beforeEach(() => {
      fetchController = installFetchMock();
    });

    afterEach(() => {
      jest.restoreAllMocks();
      fetchController.restore();
    });

    it('should successfully refresh tokens', async () => {
      const mockResponse = {
        status: 0,
        body: {
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 3600,
          userid: '12345',
          scope: 'user.info,user.metrics'
        }
      };

      fetchController.mock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const tokens = await authService.refreshToken('old_refresh_token');

      expect(tokens.accessToken).toBe('new_access_token');
      expect(tokens.refreshToken).toBe('new_refresh_token');
      expect(tokens.userId).toBe('12345');
    });

    it('should handle refresh failure', async () => {
      const mockResponse = {
        status: 401,
        error: 'invalid_grant'
      };

      fetchController.mock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await expect(
        authService.refreshToken('invalid_token')
      ).rejects.toThrow('Token refresh failed: invalid_grant');
    });
  });

  describe('revokeToken', () => {
    let fetchController: ReturnType<typeof installFetchMock>;

    beforeEach(() => {
      fetchController = installFetchMock();
    });

    afterEach(() => {
      jest.restoreAllMocks();
      fetchController.restore();
    });

    it('should successfully revoke token', async () => {
      const mockResponse = {
        status: 0
      };

      fetchController.mock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await expect(
        authService.revokeToken('test_token')
      ).resolves.not.toThrow();
    });

    it('should handle revocation failure', async () => {
      const mockResponse = {
        status: 401,
        error: 'invalid_token'
      };

      fetchController.mock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await expect(
        authService.revokeToken('invalid_token')
      ).rejects.toThrow('Token revocation failed: invalid_token');
    });
  });
});
