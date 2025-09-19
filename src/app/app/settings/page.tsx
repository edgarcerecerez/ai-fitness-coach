'use client';

import { useState } from 'react';
import { WithingsConnection } from '@/components/settings/withings-connection';
import { WithingsDevices } from '@/components/settings/withings-devices';
import { WithingsNotificationSettings } from '@/components/settings/withings-notification-settings';

export default function SettingsPage() {
  const [withingsConnected, setWithingsConnected] = useState(false);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">
          Manage your connected Withings devices, sync status, and notification preferences.
        </p>
      </div>

      <WithingsConnection onConnectionChange={setWithingsConnected} />
      <WithingsDevices isConnected={withingsConnected} />
      <WithingsNotificationSettings isConnected={withingsConnected} />
    </div>
  );
}
