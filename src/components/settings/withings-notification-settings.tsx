'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, BellRing, ShieldAlert, BellOff, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithingsNotificationPreferences, UserNotificationToken } from '@/lib/withings/types';
import { formatDateTime } from '@/lib/utils/date';

interface WithingsNotificationSettingsProps {
  isConnected: boolean;
}

interface PreferencesFormState {
  measurement_notifications: boolean;
  achievement_notifications: boolean;
  sync_failure_notifications: boolean;
  notification_methods: string[];
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
}

const DEFAULT_FORM: PreferencesFormState = {
  measurement_notifications: true,
  achievement_notifications: true,
  sync_failure_notifications: true,
  notification_methods: ['push'],
  quiet_hours_start: '',
  quiet_hours_end: '',
  timezone: 'UTC'
};

const SUPPORTED_METHODS: Array<{ value: string; label: string; description: string }> = [
  { value: 'push', label: 'Push Notifications', description: 'Send real-time alerts to your devices.' },
  { value: 'email', label: 'Email', description: 'Receive summary emails when new measurements sync.' }
];

export function WithingsNotificationSettings({ isConnected }: WithingsNotificationSettingsProps) {
  const [form, setForm] = useState<PreferencesFormState>(DEFAULT_FORM);
  const [original, setOriginal] = useState<PreferencesFormState>(DEFAULT_FORM);
  const [tokens, setTokens] = useState<UserNotificationToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(original), [form, original]);

  const loadPreferences = useCallback(async () => {
    if (!isConnected) {
      setForm(DEFAULT_FORM);
      setOriginal(DEFAULT_FORM);
      setTokens([]);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/integrations/withings/notifications');
      if (!response.ok) {
        throw new Error('Failed to load notification preferences');
      }

      const data = await response.json();
      const preferences: WithingsNotificationPreferences | undefined = data.preferences;
      const activeTokens: UserNotificationToken[] = Array.isArray(data.tokens) ? data.tokens : [];

      const next: PreferencesFormState = {
        measurement_notifications: preferences?.measurement_notifications ?? true,
        achievement_notifications: preferences?.achievement_notifications ?? true,
        sync_failure_notifications: preferences?.sync_failure_notifications ?? true,
        notification_methods: Array.isArray(preferences?.notification_methods) && (preferences?.notification_methods?.length ?? 0) > 0
          ? [...(preferences?.notification_methods ?? [])]
          : ['push'],
        quiet_hours_start: preferences?.quiet_hours_start ?? '',
        quiet_hours_end: preferences?.quiet_hours_end ?? '',
        timezone: preferences?.timezone ?? 'UTC'
      };

      setForm(next);
      setOriginal(next);
      setTokens(activeTokens);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch Withings notification preferences', err);
      setError('Unable to load notification preferences right now. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    loadPreferences().catch(() => {
      /* handled */
    });
  }, [loadPreferences]);

  const updateMethod = (method: string, enabled: boolean) => {
    setForm(prev => {
      const methods = new Set(prev.notification_methods);
      if (enabled) {
        methods.add(method);
      } else {
        methods.delete(method);
      }
      const next = Array.from(methods);
      return {
        ...prev,
        notification_methods: next.length > 0 ? next : []
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/integrations/withings/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_preferences',
          preferences: {
            measurement_notifications: form.measurement_notifications,
            achievement_notifications: form.achievement_notifications,
            sync_failure_notifications: form.sync_failure_notifications,
            notification_methods: form.notification_methods,
            quiet_hours_start: form.quiet_hours_start || null,
            quiet_hours_end: form.quiet_hours_end || null,
            timezone: form.timezone.trim() || 'UTC'
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save preferences');
      }

      const data = await response.json();
      const savedPref: WithingsNotificationPreferences | undefined = data.preferences;
      const next: PreferencesFormState = {
        measurement_notifications: savedPref?.measurement_notifications ?? form.measurement_notifications,
        achievement_notifications: savedPref?.achievement_notifications ?? form.achievement_notifications,
        sync_failure_notifications: savedPref?.sync_failure_notifications ?? form.sync_failure_notifications,
        notification_methods: Array.isArray(savedPref?.notification_methods) && (savedPref?.notification_methods?.length ?? 0) > 0
          ? [...(savedPref?.notification_methods ?? [])]
          : form.notification_methods,
        quiet_hours_start: savedPref?.quiet_hours_start ?? form.quiet_hours_start,
        quiet_hours_end: savedPref?.quiet_hours_end ?? form.quiet_hours_end,
        timezone: savedPref?.timezone ?? form.timezone
      };

      setForm(next);
      setOriginal(next);

      toast({
        title: 'Preferences saved',
        description: 'Your Withings notification settings have been updated.'
      });
      setError(null);
    } catch (err) {
      console.error('Failed to save Withings notification preferences', err);
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unable to save notification preferences.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveToken = async (token: UserNotificationToken) => {
    setRemoving(prev => ({ ...prev, [token.id]: true }));
    try {
      const response = await fetch('/api/integrations/withings/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_token', tokenId: token.id })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to remove device token');
      }

      setTokens(prev => prev.filter(item => item.id !== token.id));
      toast({
        title: 'Notification device removed',
        description: 'The notification endpoint was deactivated successfully.'
      });
    } catch (err) {
      console.error('Failed to remove notification token', err);
      toast({
        title: 'Removal failed',
        description: err instanceof Error ? err.message : 'Unable to remove this notification endpoint right now.',
        variant: 'destructive'
      });
    } finally {
      setRemoving(prev => ({ ...prev, [token.id]: false }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-blue-600" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose when and how you are notified about new Withings measurements and device events.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isConnected ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            <ShieldAlert className="h-5 w-5 text-gray-500" />
            Connect your Withings account to configure notification preferences.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Measurement Alerts</p>
                    <p className="text-sm text-gray-500">
                      Receive notifications when new measurements sync from your Withings devices.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.measurement_notifications}
                      onChange={(event) =>
                        setForm(prev => ({ ...prev, measurement_notifications: event.target.checked }))
                      }
                      disabled={saving}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {form.measurement_notifications ? 'Enabled' : 'Disabled'}
                  </label>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Sync Failure Alerts</p>
                    <p className="text-sm text-gray-500">
                      Get notified if we cannot sync your Withings data for any reason.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.sync_failure_notifications}
                      onChange={(event) =>
                        setForm(prev => ({ ...prev, sync_failure_notifications: event.target.checked }))
                      }
                      disabled={saving}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {form.sync_failure_notifications ? 'Enabled' : 'Disabled'}
                  </label>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Achievement Alerts</p>
                    <p className="text-sm text-gray-500">
                      Celebrate milestones like weight goals or streaks with optional notifications.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.achievement_notifications}
                      onChange={(event) =>
                        setForm(prev => ({ ...prev, achievement_notifications: event.target.checked }))
                      }
                      disabled={saving}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {form.achievement_notifications ? 'Enabled' : 'Disabled'}
                  </label>
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-sm font-medium text-gray-900">Delivery Methods</p>
                <div className="space-y-2">
                  {SUPPORTED_METHODS.map(method => {
                    const checked = form.notification_methods.includes(method.value);
                    return (
                      <label
                        key={method.value}
                        className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{method.label}</p>
                          <p className="text-sm text-gray-500">{method.description}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => updateMethod(method.value, event.target.checked)}
                          disabled={saving}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </label>
                    );
                  })}
                </div>
                {form.notification_methods.length === 0 && (
                  <p className="text-xs text-red-600">
                    Select at least one delivery method to receive notifications.
                  </p>
                )}
              </section>

              <section className="space-y-3">
                <p className="text-sm font-medium text-gray-900">Quiet Hours</p>
                <p className="text-sm text-gray-500">
                  Pauses notifications between the selected times. Leave blank to receive alerts at any time.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="quiet-start" className="text-sm font-medium text-gray-700">
                      Quiet hours start
                    </Label>
                    <Input
                      id="quiet-start"
                      type="time"
                      value={form.quiet_hours_start}
                      onChange={(event) =>
                        setForm(prev => ({ ...prev, quiet_hours_start: event.target.value }))
                      }
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quiet-end" className="text-sm font-medium text-gray-700">
                      Quiet hours end
                    </Label>
                    <Input
                      id="quiet-end"
                      type="time"
                      value={form.quiet_hours_end}
                      onChange={(event) =>
                        setForm(prev => ({ ...prev, quiet_hours_end: event.target.value }))
                      }
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone" className="text-sm font-medium text-gray-700">
                    Timezone
                  </Label>
                  <Input
                    id="timezone"
                    value={form.timezone}
                    onChange={(event) =>
                      setForm(prev => ({ ...prev, timezone: event.target.value }))
                    }
                    placeholder="e.g. America/Los_Angeles"
                    disabled={saving}
                  />
                </div>
              </section>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !isDirty || form.notification_methods.length === 0}
              className="flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              Save preferences
            </Button>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">Registered Notification Endpoints</p>
                <Badge variant="secondary">{tokens.length}</Badge>
              </div>
              {tokens.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                  <BellOff className="mb-2 h-4 w-4 text-gray-500" />
                  You do not have any active push endpoints registered. Connect from a supported device to
                  receive real-time notifications.
                </div>
              ) : (
                <div className="space-y-2">
                  {tokens.map(token => (
                    <div
                      key={token.id}
                      className="flex flex-col items-start gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900 capitalize">{token.platform}</p>
                        <p className="text-xs text-gray-500">
                          Last used {token.last_used_at ? formatDateTime(token.last_used_at) : 'recently'}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveToken(token)}
                        disabled={removing[token.id] || saving}
                        className="flex items-center gap-2"
                      >
                        {removing[token.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <BellOff className="h-4 w-4" />
                        )}
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
