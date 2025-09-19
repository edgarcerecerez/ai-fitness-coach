'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Bell, BellOff, ShieldAlert, BatteryFull, Activity, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithingsDevice } from '@/lib/withings/types';
import { formatDateTime } from '@/lib/utils/date';

interface WithingsDevicesProps {
  isConnected: boolean;
}

interface DeviceState extends WithingsDevice {
  notificationEnabled: boolean;
}

const DEVICE_LABELS: Record<string, string> = {
  scale: 'Smart Scale',
  blood_pressure: 'Blood Pressure Monitor',
  activity_tracker: 'Activity Tracker',
  sleep_monitor: 'Sleep Monitor',
  thermometer: 'Thermometer'
};

function formatDeviceType(type: string): string {
  return DEVICE_LABELS[type] ?? type.replace(/_/g, ' ');
}

function formatBatteryLevel(level?: number | string): string {
  if (level === undefined || level === null) {
    return 'Unknown';
  }

  if (typeof level === 'string') {
    return level.charAt(0).toUpperCase() + level.slice(1);
  }

  if (level >= 80) return 'High';
  if (level >= 40) return 'Medium';
  if (level >= 15) return 'Low';
  return 'Critical';
}

export function WithingsDevices({ isConnected }: WithingsDevicesProps) {
  const [devices, setDevices] = useState<DeviceState[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const hasDevices = useMemo(() => devices.length > 0, [devices]);

  const loadDevices = useCallback(
    async (opts: { showSpinner?: boolean } = {}) => {
      if (!isConnected) {
        setDevices([]);
        setError(null);
        return;
      }

      if (opts.showSpinner) {
        setLoading(true);
      }

      try {
        const response = await fetch('/api/integrations/withings/devices');
        if (!response.ok) {
          throw new Error('Failed to load devices');
        }

        const data = await response.json();
        const result = Array.isArray(data.devices) ? data.devices : [];
        setDevices(result.map((device: WithingsDevice) => ({
          ...device,
          notificationEnabled: device.notificationEnabled ?? true
        })));
        setError(null);
      } catch (err) {
        console.error('Failed to fetch Withings devices', err);
        setError('Unable to load devices right now. Please try again later.');
      } finally {
        if (opts.showSpinner) {
          setLoading(false);
        }
      }
    },
    [isConnected]
  );

  useEffect(() => {
    loadDevices({ showSpinner: true }).catch(() => {
      /* error handled in loadDevices */
    });
  }, [loadDevices]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/integrations/withings/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to refresh devices');
      }

      const data = await response.json();
      const refreshedDevices = Array.isArray(data.devices) ? data.devices : [];
      setDevices(refreshedDevices.map((device: WithingsDevice) => ({
        ...device,
        notificationEnabled: device.notificationEnabled ?? true
      })));

      toast({
        title: 'Devices updated',
        description: 'Your Withings device list has been refreshed.'
      });
      setError(null);
    } catch (err) {
      console.error('Failed to refresh Withings devices', err);
      toast({
        title: 'Refresh failed',
        description: err instanceof Error ? err.message : 'Unable to refresh devices right now.',
        variant: 'destructive'
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleNotifications = async (device: DeviceState) => {
    const nextEnabled = !device.notificationEnabled;
    setToggling(prev => ({ ...prev, [device.id]: true }));

    try {
      const response = await fetch('/api/integrations/withings/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_notifications',
          deviceId: device.id,
          enabled: nextEnabled
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update notifications');
      }

      setDevices(prev => prev.map(d => (
        d.id === device.id ? { ...d, notificationEnabled: nextEnabled } : d
      )));

      toast({
        title: 'Notification preferences saved',
        description: `${formatDeviceType(device.type)} notifications ${nextEnabled ? 'enabled' : 'disabled'}.`
      });
    } catch (err) {
      console.error('Failed to toggle device notifications', err);
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Unable to update device notifications right now.',
        variant: 'destructive'
      });
    } finally {
      setToggling(prev => ({ ...prev, [device.id]: false }));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Withings Devices
          </CardTitle>
          <CardDescription>
            Manage the devices linked to your Withings account and control alerts for each device.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={!isConnected || refreshing}
          className="flex items-center gap-2 self-start md:self-auto"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {!isConnected ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            <ShieldAlert className="h-5 w-5 text-gray-500" />
            Connect your Withings account to view and manage registered devices.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : hasDevices ? (
          <div className="space-y-4">
            {devices.map(device => (
              <div
                key={device.id}
                className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-gray-900">
                      {device.model || formatDeviceType(device.type)}
                    </h3>
                    <Badge variant="secondary">{formatDeviceType(device.type)}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <BatteryFull className="h-4 w-4 text-green-600" />
                      Battery: {formatBatteryLevel(device.batteryLevel)}
                    </span>
                    {device.lastSessionDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-gray-500" />
                        Last session: {formatDateTime(device.lastSessionDate)}
                      </span>
                    )}
                    {device.lastSeenAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-gray-500" />
                        Seen: {formatDateTime(device.lastSeenAt)}
                      </span>
                    )}
                  </div>
                  {device.features && device.features.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {device.features.map(feature => (
                        <Badge key={feature} variant="outline" className="text-xs">
                          {feature.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 self-start md:self-auto">
                  <Button
                    variant={device.notificationEnabled ? 'outline' : 'secondary'}
                    size="sm"
                    onClick={() => handleToggleNotifications(device)}
                    disabled={toggling[device.id]}
                    className="flex items-center gap-2"
                  >
                    {toggling[device.id] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : device.notificationEnabled ? (
                      <Bell className="h-4 w-4" />
                    ) : (
                      <BellOff className="h-4 w-4" />
                    )}
                    {device.notificationEnabled ? 'Disable Alerts' : 'Enable Alerts'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
            <Activity className="mx-auto mb-3 h-6 w-6 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">No devices detected yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Once you sync with Withings, your connected devices will appear here automatically.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
