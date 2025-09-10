// Token encryption utilities for secure storage
import crypto from 'crypto';
import { EncryptedData } from './types';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const key = process.env.WITHINGS_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('WITHINGS_ENCRYPTION_KEY environment variable is not set');
  }
  
  // Validate hex string format
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('WITHINGS_ENCRYPTION_KEY must be a 32-byte hex string (64 characters)');
  }
  
  return Buffer.from(key, 'hex');
}

export function encryptToken(token: string): EncryptedData {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12); // 12-byte IV for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(Buffer.from('withings-token'));
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error: unknown) {
    throw new Error('Token encryption failed', { cause: error });
  }
}

export function decryptToken(encryptedData: EncryptedData): string {
  try {
    const key = getEncryptionKey();
    const { encryptedData: encrypted, iv, authTag } = encryptedData;
    const ivBuffer = Buffer.from(iv, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
    decipher.setAAD(Buffer.from('withings-token'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: unknown) {
    throw new Error('Token decryption failed', { cause: error });
  }
}

// Utility to generate a new encryption key (for setup)
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}