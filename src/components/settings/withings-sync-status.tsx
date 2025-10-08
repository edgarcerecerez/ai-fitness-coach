'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { formatSyncTimestamp, getSyncStatusBadgeVariant } from '@/lib/sync-helpers';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface SyncLog {
  readonly id: string;
  readonly user_id: string;
  readonly sync_type: 'weight' | 'activity' | 'sleep';
  readonly status: 'pending' | 'success' | 'error';
  readonly started_at: string;
  readonly completed_at?: string;
  readonly error_message?: string;
  readonly records_synced?: number;
}

export function WithingsSyncStatus() {
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function setupWithingsRealtime(): Promise<RealtimeChannel | null> {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    // Initial fetch
    const { data: initialLogs } = await supabase
      .from('withings_sync_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(10);

    if (initialLogs) {
      setSyncLogs(initialLogs);
    }
    setLoading(false);

    // Set up real-time subscription
    const channel = supabase
      .channel('withings_sync_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'withings_sync_logs',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Type guard for realtime payload
          function isValidSyncLog(obj: unknown): obj is SyncLog {
            return (
              obj &&
              typeof obj === 'object' &&
              obj !== null &&
              typeof (obj as SyncLog).id === 'string' &&
              typeof (obj as SyncLog).user_id === 'string' &&
              ['weight', 'activity', 'sleep'].includes((obj as SyncLog).sync_type) &&
              ['pending', 'success', 'error'].includes((obj as SyncLog).status) &&
              typeof (obj as SyncLog).started_at === 'string'
            );
          }

          if (payload.eventType === 'INSERT' && payload.new && isValidSyncLog(payload.new)) {
            // New sync started
            setSyncLogs((prev) => [payload.new, ...prev].slice(0, 10));
          } else if (payload.eventType === 'UPDATE' && payload.new && isValidSyncLog(payload.new)) {
            // Sync status updated (completed or failed)
            setSyncLogs((prev) =>
              prev.map((log) =>
                log.id === payload.new.id ? payload.new : log
              )
            );
          } else if (payload.eventType === 'DELETE' && payload.old && typeof payload.old.id === 'string') {
            // Sync log deleted
            setSyncLogs((prev) => prev.filter((log) => log.id !== payload.old.id));
          } else {
            console.warn('Invalid realtime payload received:', payload);
          }
        }
      )
      .subscribe();

    return channel;
  }

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    setupWithingsRealtime()
      .then((createdChannel) => {
        channel = createdChannel;
      })
      .catch((error) => {
        console.error('Failed to setup Withings realtime:', error?.stack ?? error);
        setLoading(false);
      });

    // Cleanup
    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase, setupWithingsRealtime]);


  const getStatusIcon = (status: SyncLog['status']) => {
    switch (status) {
      case 'pending':
        return <RefreshCw className="h-4 w-4 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-chart-1" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusBadge = (status: SyncLog['status']) => {
    return <Badge variant={getSyncStatusBadgeVariant(status)} className="capitalize">
      {status === 'pending' ? 'Syncing' : status === 'success' ? 'Success' : 'Failed'}
    </Badge>;
  };


  if (loading) {
    return (
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Sync Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Sync Status
          {syncLogs.some((log) => log.status === 'pending') && (
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {syncLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No sync activity yet
          </div>
        ) : (
          <div className="space-y-3">
            {syncLogs.map((log) => (
              <div
                key={log.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  log.status === 'pending'
                    ? 'bg-primary/5 border-primary/20'
                    : log.status === 'success'
                    ? 'bg-chart-1/5 border-chart-1/20'
                    : 'bg-destructive/5 border-destructive/20'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIcon(log.status)}
                  <div>
                    <div className="font-medium text-sm capitalize">
                      {log.sync_type} Sync
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatSyncTimestamp(log.started_at)}
                      {log.records_synced !== undefined &&
                        ` • ${log.records_synced} records`}
                    </div>
                    {log.error_message && (
                      <div className="text-xs text-destructive mt-1">
                        {log.error_message}
                      </div>
                    )}
                  </div>
                </div>
                {getStatusBadge(log.status)}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}