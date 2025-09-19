import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { WithingsNotificationService } from '@/lib/withings/notification-service';
import { apiLogger } from '@/lib/logger';
import type { WithingsNotificationPreferences } from '@/lib/withings/types';

const notificationService = new WithingsNotificationService();
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SUPPORTED_METHODS = new Set(['push', 'email']);

type UpdatePreferencesBody = {
  measurement_notifications?: unknown;
  achievement_notifications?: unknown;
  sync_failure_notifications?: unknown;
  notification_methods?: unknown;
  quiet_hours_start?: unknown;
  quiet_hours_end?: unknown;
  timezone?: unknown;
};

type RegisterTokenBody = {
  token?: unknown;
  platform?: unknown;
};

type RemoveTokenBody = {
  tokenId?: unknown;
};

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    apiLogger.warn('Unauthorized access to Withings notification preferences', { authError });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [preferences, tokens] = await Promise.all([
      notificationService.getPreferences(user.id),
      notificationService.getActiveTokens(user.id)
    ]);

    return NextResponse.json({ preferences, tokens });
  } catch (error) {
    apiLogger.error('Failed to load Withings notification preferences', {
      userId: user.id,
      error
    });
    return NextResponse.json({ error: 'Failed to load notification preferences' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    apiLogger.warn('Unauthorized mutation attempt on Withings notifications', { authError });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { action?: string } & Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = typeof body.action === 'string' ? body.action : 'update_preferences';

  try {
    switch (action) {
      case 'update_preferences': {
        const updates = body.preferences ?? body;
        const parsed = parsePreferenceUpdates(updates as UpdatePreferencesBody);

        if (Object.keys(parsed).length === 0) {
          return NextResponse.json({ error: 'No valid preference fields provided' }, { status: 400 });
        }

        const preferences = await notificationService.updatePreferences(user.id, parsed);
        return NextResponse.json({ success: true, preferences });
      }

      case 'register_token': {
        const { token, platform } = body as RegisterTokenBody;

        if (typeof token !== 'string' || token.length === 0) {
          return NextResponse.json({ error: 'Token is required' }, { status: 400 });
        }

        if (typeof platform !== 'string' || !['web', 'ios', 'android'].includes(platform)) {
          return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
        }

        await notificationService.registerToken(user.id, token, platform);
        const tokens = await notificationService.getActiveTokens(user.id);
        return NextResponse.json({ success: true, tokens });
      }

      case 'remove_token': {
        const { tokenId } = body as RemoveTokenBody;

        if (typeof tokenId !== 'string' || tokenId.length === 0) {
          return NextResponse.json({ error: 'tokenId is required' }, { status: 400 });
        }

        await notificationService.removeToken(user.id, tokenId);
        const tokens = await notificationService.getActiveTokens(user.id);
        return NextResponse.json({ success: true, tokens });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    apiLogger.error('Withings notification preferences update failed', {
      userId: user.id,
      action,
      error
    });
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}

function parsePreferenceUpdates(
  body: UpdatePreferencesBody
): Partial<Omit<WithingsNotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>> {
  const updates: Partial<Omit<WithingsNotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>> = {};

  if (typeof body.measurement_notifications === 'boolean') {
    updates.measurement_notifications = body.measurement_notifications;
  }

  if (typeof body.achievement_notifications === 'boolean') {
    updates.achievement_notifications = body.achievement_notifications;
  }

  if (typeof body.sync_failure_notifications === 'boolean') {
    updates.sync_failure_notifications = body.sync_failure_notifications;
  }

  if (Array.isArray(body.notification_methods)) {
    const methods = body.notification_methods.filter(
      method => typeof method === 'string' && SUPPORTED_METHODS.has(method)
    ) as string[];
    updates.notification_methods = methods;
  }

  if (isTimeValue(body.quiet_hours_start)) {
    updates.quiet_hours_start = body.quiet_hours_start;
  } else if (body.quiet_hours_start === null) {
    updates.quiet_hours_start = null;
  }

  if (isTimeValue(body.quiet_hours_end)) {
    updates.quiet_hours_end = body.quiet_hours_end;
  } else if (body.quiet_hours_end === null) {
    updates.quiet_hours_end = null;
  }

  if (typeof body.timezone === 'string' && body.timezone.trim().length > 0) {
    updates.timezone = body.timezone.trim();
  }

  return updates;
}

function isTimeValue(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}
