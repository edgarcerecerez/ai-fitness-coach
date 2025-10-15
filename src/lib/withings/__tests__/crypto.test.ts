// Unit tests for crypto utilities
import { encryptToken, decryptToken, generateEncryptionKey } from '../crypto';

// Mock environment variable
const mockEncryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Crypto utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, WITHINGS_ENCRYPTION_KEY: mockEncryptionKey };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('encryptToken', () => {
    it('should encrypt a token successfully', () => {
      const token = 'test_access_token_12345';
      const encrypted = encryptToken(token);

      expect(encrypted).toHaveProperty('encryptedData');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      
      expect(encrypted.encryptedData).toHaveLength(token.length * 2); // hex encoded
      expect(encrypted.iv).toHaveLength(24); // 12 bytes as hex = 24 characters
      expect(encrypted.authTag).toHaveLength(32); // 16 bytes as hex = 32 characters
    });

    it('should produce different encryption results for same token', () => {
      const token = 'test_token';
      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      // Different IVs should produce different results
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);
      expect(encrypted1.authTag).not.toBe(encrypted2.authTag);
    });

    it('should throw error if encryption key is missing', () => {
      delete process.env.WITHINGS_ENCRYPTION_KEY;
      expect(() => encryptToken('test')).toThrow('WITHINGS_ENCRYPTION_KEY environment variable is not set');
    });

    it('should throw error if encryption key is invalid', () => {
      process.env.WITHINGS_ENCRYPTION_KEY = 'invalid_key';
      expect(() => encryptToken('test')).toThrow('WITHINGS_ENCRYPTION_KEY must be a 32-byte hex string');
    });
  });

  describe('decryptToken', () => {
    it('should decrypt a token successfully', () => {
      const originalToken = 'test_access_token_12345';
      const encrypted = encryptToken(originalToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(originalToken);
    });

    it('should handle empty token', () => {
      const originalToken = '';
      const encrypted = encryptToken(originalToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(originalToken);
    });

    it('should handle special characters', () => {
      const originalToken = 'token_with_special_chars_!@#$%^&*()';
      const encrypted = encryptToken(originalToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(originalToken);
    });

    it('should throw error for tampered encrypted data', () => {
      const originalToken = 'test_token';
      const encrypted = encryptToken(originalToken);
      
      // Tamper with encrypted data
      encrypted.encryptedData = encrypted.encryptedData.replace('a', 'b');

      expect(() => decryptToken(encrypted)).toThrow('Token decryption failed');
    });

    it('should throw error for tampered auth tag', () => {
      const originalToken = 'test_token';
      const encrypted = encryptToken(originalToken);
      
      // Tamper with auth tag
      encrypted.authTag = encrypted.authTag.replace('a', 'b');

      expect(() => decryptToken(encrypted)).toThrow('Token decryption failed');
    });

    it('should throw error for invalid IV', () => {
      const originalToken = 'test_token';
      const encrypted = encryptToken(originalToken);
      
      // Invalid IV
      encrypted.iv = 'invalid_iv';

      expect(() => decryptToken(encrypted)).toThrow('Token decryption failed');
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate valid 32-byte hex key', () => {
      const key = generateEncryptionKey();
      
      expect(key).toHaveLength(64); // 32 bytes as hex = 64 characters
      expect(/^[0-9a-f]{64}$/.test(key)).toBe(true); // Valid hex string
    });

    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      
      expect(key1).not.toBe(key2);
    });

    it('generated key should work with encrypt/decrypt', () => {
      const generatedKey = generateEncryptionKey();
      process.env.WITHINGS_ENCRYPTION_KEY = generatedKey;
      
      const token = 'test_token_with_generated_key';
      const encrypted = encryptToken(token);
      const decrypted = decryptToken(encrypted);
      
      expect(decrypted).toBe(token);
    });
  });

  describe('round-trip encryption/decryption', () => {
    it('should handle various token formats', () => {
      const testTokens = [
        'simple_token',
        'token.with.dots',
        'token-with-dashes',
        'token_with_underscores',
        'TokenWithCamelCase',
        'token123with456numbers',
        'very_long_token_that_might_exceed_typical_lengths_and_contain_various_characters_0123456789',
        'token with spaces',
        'token\nwith\nnewlines',
        '{"token":"in_json_format","expires":3600}',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' // JWT-like format
      ];

      testTokens.forEach(token => {
        const encrypted = encryptToken(token);
        const decrypted = decryptToken(encrypted);
        expect(decrypted).toBe(token);
      });
    });
  });
});