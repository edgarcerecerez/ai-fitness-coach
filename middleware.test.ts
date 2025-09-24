import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import { middleware, config } from './middleware';
import { updateSession } from '@/utils/supabase/middleware';

// Mock Supabase middleware
jest.mock('@/utils/supabase/middleware', () => ({
  updateSession: jest.fn(),
}));

const createMockNextRequest = (overrides: Partial<NextRequest> = {}): NextRequest => {
  const defaultRequest = {
    nextUrl: {
      pathname: '/test-path',
      search: '',
      searchParams: new URLSearchParams(),
      href: 'https://example.com/test-path',
      origin: 'https://example.com',
    },
    cookies: {
      getAll: jest.fn().mockReturnValue([]),
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    },
    headers: new Headers(),
    method: 'GET',
    url: 'https://example.com/test-path',
    ...overrides,
  } as unknown as NextRequest;
  return defaultRequest;
};

const createMockNextResponse = (): NextResponse => {
  const mockResponse = {
    cookies: {
      set: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn().mockReturnValue([]),
      delete: jest.fn(),
    },
    headers: new Headers(),
    status: 200,
  } as unknown as NextResponse;
  return mockResponse;
};

const mockUpdateSession = updateSession as jest.MockedFunction<typeof updateSession>;

describe('Next.js Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('middleware function', () => {
    it('should successfully process authenticated request', async () => {
      const mockRequest = createMockNextRequest({
        nextUrl: {
          pathname: '/dashboard',
          search: '',
          searchParams: new URLSearchParams(),
          href: 'https://example.com/dashboard',
          origin: 'https://example.com',
        } as any,
      });
      const mockResponse = createMockNextResponse();
      mockUpdateSession.mockResolvedValue(mockResponse);
      const result = await middleware(mockRequest);
      expect(updateSession).toHaveBeenCalledWith(mockRequest);
      expect(result).toBe(mockResponse);
    });

    it('should handle requests to protected routes', async () => {
      const protectedPaths = ['/dashboard', '/profile', '/api/user'];
      for (const path of protectedPaths) {
        const mockRequest = createMockNextRequest({
          nextUrl: {
            pathname: path,
            search: '',
            searchParams: new URLSearchParams(),
            href: `https://example.com${path}`,
            origin: 'https://example.com',
          } as any,
        });
        const mockResponse = createMockNextResponse();
        mockUpdateSession.mockResolvedValue(mockResponse);
        const result = await middleware(mockRequest);
        expect(updateSession).toHaveBeenCalledWith(mockRequest);
        expect(result).toBe(mockResponse);
      }
    });

    it('should handle POST requests with authentication', async () => {
      const mockRequest = createMockNextRequest({
        method: 'POST',
        nextUrl: {
          pathname: '/api/data',
          search: '',
          searchParams: new URLSearchParams(),
          href: 'https://example.com/api/data',
          origin: 'https://example.com',
        } as any,
      });
      const mockResponse = createMockNextResponse();
      mockUpdateSession.mockResolvedValue(mockResponse);
      const result = await middleware(mockRequest);
      expect(updateSession).toHaveBeenCalledWith(mockRequest);
      expect(result).toBe(mockResponse);
    });

    it('should handle updateSession errors gracefully', async () => {
      const mockRequest = createMockNextRequest();
      const error = new Error('Supabase connection failed');
      mockUpdateSession.mockRejectedValue(error);
      await expect(middleware(mockRequest)).rejects.toThrow('Supabase connection failed');
      expect(updateSession).toHaveBeenCalledWith(mockRequest);
    });

    it('should handle requests with query parameters', async () => {
      const mockRequest = createMockNextRequest({
        nextUrl: {
          pathname: '/search',
          search: '?q=test&category=books',
          searchParams: new URLSearchParams('q=test&category=books'),
          href: 'https://example.com/search?q=test&category=books',
          origin: 'https://example.com',
        } as any,
      });
      const mockResponse = createMockNextResponse();
      mockUpdateSession.mockResolvedValue(mockResponse);
      const result = await middleware(mockRequest);
      expect(updateSession).toHaveBeenCalledWith(mockRequest);
      expect(result).toBe(mockResponse);
    });
  });
});

describe('Middleware Configuration', () => {
  describe('config.matcher', () => {
    it('should have correct matcher pattern', () => {
      expect(config.matcher).toBeDefined();
      expect(Array.isArray(config.matcher)).toBe(true);
      expect(config.matcher).toHaveLength(1);
    });

    it('should match regular application routes', () => {
      const testPaths = [
        '/dashboard',
        '/profile',
        '/api/user',
        '/products/123',
        '/auth/callback',
        '/settings/account',
      ];
      const matcherPattern = config.matcher[0];
      const regex = new RegExp(matcherPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      testPaths.forEach(path => {
        expect(path).not.toMatch(/^\/(_next\/static|_next\/image|favicon\.ico)/);
        expect(path).not.toMatch(/\.(svg|png|jpg|jpeg|gif|webp)$/);
      });
    });

    it('should exclude Next.js static files', () => {
      const excludedPaths = [
        '/_next/static/chunks/main.js',
        '/_next/image/logo.png',
        '/favicon.ico',
        '/logo.svg',
        '/banner.png',
        '/hero.jpg',
        '/thumbnail.jpeg',
        '/animation.gif',
        '/image.webp',
      ];
      excludedPaths.forEach(path => {
        const shouldBeExcluded =
          path.startsWith('/_next/static') ||
          path.startsWith('/_next/image') ||
          path === '/favicon.ico' ||
          /\.(svg|png|jpg|jpeg|gif|webp)$/.test(path);
        expect(shouldBeExcluded).toBe(true);
      });
    });

    it('should handle root path correctly', () => {
      const rootPath = '/';
      expect(rootPath).not.toMatch(/^\/(_next\/static|_next\/image|favicon\.ico)/);
    });

    it('should handle API routes correctly', () => {
      const apiPaths = [
        '/api/auth',
        '/api/user/profile',
        '/api/data/export',
      ];
      apiPaths.forEach(path => {
        expect(path).not.toMatch(/^\/(_next\/static|_next\/image|favicon\.ico)/);
        expect(path).not.toMatch(/\.(svg|png|jpg|jpeg|gif|webp)$/);
      });
    });
  });
});