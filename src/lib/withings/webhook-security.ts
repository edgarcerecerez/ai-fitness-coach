import crypto from 'crypto';
import { WithingsWebhookNotification } from './types';

const isWebhookNotification = (value: unknown): value is Partial<WithingsWebhookNotification> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export class WithingsWebhookSecurity {
  private readonly clientSecret: string;

  constructor() {
    this.clientSecret = process.env.WITHINGS_CLIENT_SECRET!;
    if (!this.clientSecret) {
      throw new Error('WITHINGS_CLIENT_SECRET environment variable is required');
    }
  }

  /**
   * Validate webhook signature
   */
  validateSignature(payload: string, signature: string, timestamp: string): boolean {
    // Withings uses HMAC-SHA256 for signature validation
    const expectedSignature = this.generateSignature(payload, timestamp);
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Generate expected signature
   */
  private generateSignature(payload: string, timestamp: string): string {
    const data = `${timestamp}${payload}`;
    return crypto
      .createHmac('sha256', this.clientSecret)
      .update(data, 'utf8')
      .digest('hex');
  }

  /**
   * Check if timestamp is within acceptable range (5 minutes)
   */
  isTimestampValid(timestamp: string): boolean {
    const webhookTime = parseInt(timestamp, 10) * 1000; // Convert to milliseconds
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    return Math.abs(now - webhookTime) <= fiveMinutes;
  }

  /**
   * Validate webhook payload structure
   */
  validatePayload(payload: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const data = isWebhookNotification(payload) ? payload : {};

    if (!data?.userid) {
      errors.push('Missing userid');
    }

    if (!data?.appli) {
      errors.push('Missing application ID');
    }

    if (!data?.startdate || !data?.enddate) {
      errors.push('Missing date range');
    }

    if (!data?.date) {
      errors.push('Missing notification date');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
