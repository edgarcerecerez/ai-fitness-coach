import {
  AppError,
  ValidationError,
  AuthenticationError,
  handleApiError,
  isNetworkError,
  getErrorStatusCode,
  formatErrorForClient,
} from '../errors';

describe('Error Handling Utilities', () => {
  describe('AppError', () => {
    it('creates error with message and code', () => {
      const error = new AppError('Test error', 'TEST_ERROR', 400);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('AppError');
    });

    it('includes details when provided', () => {
      const error = new AppError('Test error', 'TEST_ERROR', 400, {
        field: 'email',
      });

      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('ValidationError', () => {
    it('creates validation error with 400 status', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('handleApiError', () => {
    it('extracts message from AppError', () => {
      const error = new AppError('Custom error');
      expect(handleApiError(error)).toBe('Custom error');
    });

    it('extracts message from standard Error', () => {
      const error = new Error('Standard error');
      expect(handleApiError(error)).toBe('Standard error');
    });

    it('handles string errors', () => {
      expect(handleApiError('String error')).toBe('String error');
    });

    it('returns default message for unknown errors', () => {
      expect(handleApiError({ weird: 'object' })).toBe(
        'An unexpected error occurred'
      );
    });
  });

  describe('isNetworkError', () => {
    it('identifies fetch errors', () => {
      const error = new TypeError('fetch failed');
      expect(isNetworkError(error)).toBe(true);
    });

    it('identifies network errors', () => {
      const error = new TypeError('network error');
      expect(isNetworkError(error)).toBe(true);
    });

    it('returns false for non-network errors', () => {
      const error = new Error('Regular error');
      expect(isNetworkError(error)).toBe(false);
    });
  });

  describe('getErrorStatusCode', () => {
    it('returns AppError status code', () => {
      const error = new AppError('Test', 'TEST', 404);
      expect(getErrorStatusCode(error)).toBe(404);
    });

    it('returns 500 for unknown errors', () => {
      const error = new Error('Test');
      expect(getErrorStatusCode(error)).toBe(500);
    });
  });

  describe('formatErrorForClient', () => {
    it('formats AppError correctly', () => {
      const error = new AppError('Test error', 'TEST', 400, { field: 'test' });
      const formatted = formatErrorForClient(error);

      expect(formatted).toEqual({
        message: 'Test error',
        code: 'TEST',
        details: { field: 'test' },
      });
    });

    it('formats standard Error correctly', () => {
      const error = new Error('Standard error');
      const formatted = formatErrorForClient(error);

      expect(formatted).toEqual({
        message: 'Standard error',
        code: 'INTERNAL_ERROR',
      });
    });
  });
});
