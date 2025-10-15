# Phase 8.4: Architectural Improvements - Technical Implementation

## Summary

**Goal**: Replace polling with real-time subscriptions, create shared components, and improve error handling patterns.

**Priority**: 🟡 HIGH
**Duration**: Week 4 (32-42 hours)
**Dependencies**: Phase 8.1 (StatusAlert), Phase 8.3 (Badge variants)

### What We're Achieving

This phase addresses architectural issues that impact performance, battery life, and maintainability:

1. **Real-time Subscriptions** - Replace 3 setInterval polling instances with Supabase real-time
2. **Shared Components** - Create reusable StatusAlert component to eliminate 8+ duplicated alert patterns
3. **Error Handling** - Implement ErrorBoundary and standardized error handling utilities
4. **Code Organization** - Clean up duplicated logic and improve separation of concerns

**Impact**: Better UX (instant updates), lower battery drain, more maintainable codebase.

### Success Criteria

- [ ] Zero polling instances (setInterval replaced with real-time)
- [ ] StatusAlert component used throughout (8+ files updated)
- [ ] ErrorBoundary wrapping all app routes
- [ ] Standardized error handling in all API routes
- [ ] Real-time updates working (<500ms latency)
- [ ] All tests passing

---

## Technical Implementation

### Task 8.4.1: Replace Polling with Supabase Real-time

**Problem**: 3 files use setInterval polling, causing battery drain and poor UX:
- `withings-sync-status.tsx` - Polls every 5 seconds
- `pwa/sync-service.ts` - Polls every 60 seconds
- `pwa/service-worker.ts` - Polls every 5 minutes (acceptable, keep)

**Solution**: Implement Supabase real-time subscriptions for instant updates.

#### Issue 1: Withings Sync Status Polling

**Current Code** (`src/components/settings/withings-sync-status.tsx:80`):

```typescript
// CURRENT IMPLEMENTATION (BAD):
useEffect(() => {
  const interval = setInterval(() => {
    fetchSyncStatus();
  }, 5000); // Polls every 5 seconds! 🔴

  return () => clearInterval(interval);
}, []);
```

**Problems**:
- API spam (720 requests/hour per user)
- Battery drain on mobile
- Delayed updates (up to 5 seconds)
- Server load

**Solution**: Supabase real-time subscription

#### Files to Update

**File**: `src/components/settings/withings-sync-status.tsx`

Complete rewrite with real-time:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SyncLog {
  id: string;
  user_id: string;
  sync_type: 'weight' | 'activity' | 'sleep';
  status: 'pending' | 'success' | 'error';
  started_at: string;
  completed_at?: string;
  error_message?: string;
  records_synced?: number;
}

export function WithingsSyncStatus() {
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let channel: RealtimeChannel;

    async function setupRealtimeSubscription() {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

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
      channel = supabase
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
            console.log('Sync status changed:', payload);

            if (payload.eventType === 'INSERT') {
              // New sync started
              setSyncLogs((prev) => [payload.new as SyncLog, ...prev].slice(0, 10));
            } else if (payload.eventType === 'UPDATE') {
              // Sync status updated (completed or failed)
              setSyncLogs((prev) =>
                prev.map((log) =>
                  log.id === payload.new.id ? (payload.new as SyncLog) : log
                )
              );
            } else if (payload.eventType === 'DELETE') {
              // Sync log deleted
              setSyncLogs((prev) => prev.filter((log) => log.id !== payload.old.id));
            }
          }
        )
        .subscribe();
    }

    setupRealtimeSubscription();

    // Cleanup
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const getStatusIcon = (status: SyncLog['status']) => {
    switch (status) {
      case 'pending':
        return <RefreshCw className="h-4 w-4 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-chart-1" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusBadge = (status: SyncLog['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="info">Syncing</Badge>;
      case 'success':
        return <Badge variant="success">Success</Badge>;
      case 'error':
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Card variant="glass">
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
    <Card variant="glass">
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
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border',
                  log.status === 'pending' && 'bg-primary/5 border-primary/20',
                  log.status === 'success' && 'bg-chart-1/5 border-chart-1/20',
                  log.status === 'error' && 'bg-destructive/5 border-destructive/20'
                )}
              >
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIcon(log.status)}
                  <div>
                    <div className="font-medium text-sm capitalize">
                      {log.sync_type} Sync
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTimestamp(log.started_at)}
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
```

#### Database Migration

**File**: `supabase/migrations/YYYYMMDDHHMMSS_enable_realtime_withings.sql`

```sql
-- Enable real-time for withings_sync_logs table
ALTER PUBLICATION supabase_realtime ADD TABLE withings_sync_logs;

-- Ensure table exists with correct structure
CREATE TABLE IF NOT EXISTS withings_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('weight', 'activity', 'sleep')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'error')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  records_synced INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_withings_sync_logs_user_id ON withings_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_withings_sync_logs_started_at ON withings_sync_logs(started_at DESC);

-- RLS policies
ALTER TABLE withings_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync logs"
  ON withings_sync_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert sync logs"
  ON withings_sync_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update sync logs"
  ON withings_sync_logs FOR UPDATE
  USING (true);
```

#### Testing

**File**: `src/components/settings/__tests__/withings-sync-status.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { WithingsSyncStatus } from '../withings-sync-status';
import { createClient } from '@/utils/supabase/client';

jest.mock('@/utils/supabase/client');

describe('WithingsSyncStatus with Real-time', () => {
  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  };

  beforeEach(() => {
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('fetches initial sync logs', async () => {
    const mockLogs = [
      {
        id: '1',
        user_id: 'user-1',
        sync_type: 'weight',
        status: 'success',
        started_at: new Date().toISOString(),
        records_synced: 5,
      },
    ];

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: mockLogs }),
          }),
        }),
      }),
    });

    mockSupabase.channel.mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    });

    render(<WithingsSyncStatus />);

    await waitFor(() => {
      expect(screen.getByText('Weight Sync')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
    });
  });

  it('sets up real-time subscription', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [] }),
          }),
        }),
      }),
    });

    const mockOn = jest.fn().mockReturnThis();
    const mockSubscribe = jest.fn();

    mockSupabase.channel.mockReturnValue({
      on: mockOn,
      subscribe: mockSubscribe,
    });

    render(<WithingsSyncStatus />);

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith('withings_sync_changes');
      expect(mockOn).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'withings_sync_logs',
        }),
        expect.any(Function)
      );
      expect(mockSubscribe).toHaveBeenCalled();
    });
  });

  it('cleans up subscription on unmount', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [] }),
          }),
        }),
      }),
    });

    const mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    };

    mockSupabase.channel.mockReturnValue(mockChannel);

    const { unmount } = render(<WithingsSyncStatus />);

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalled();
    });

    unmount();

    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });
});
```

---

#### Issue 2: PWA Sync Service Polling

**Current Code** (`src/lib/pwa/sync-service.ts:76`):

```typescript
// CURRENT IMPLEMENTATION (BAD):
this.syncInterval = window.setInterval(() => {
  this.syncPendingChanges();
}, 60000); // Polls every 60 seconds
```

**Solution**: Use Supabase real-time + Visibility API

**File**: `src/lib/pwa/sync-service.ts`

```typescript
'use client';

import { createClient } from '@/utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PendingChange {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
  synced: boolean;
}

export class SyncService {
  private supabase = createClient();
  private realtimeChannel?: RealtimeChannel;
  private pendingChanges: PendingChange[] = [];
  private isSyncing = false;

  async init() {
    // Load pending changes from IndexedDB
    await this.loadPendingChanges();

    // Set up real-time subscription for nutrition logs
    this.realtimeChannel = this.supabase
      .channel('nutrition_logs_sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nutrition_logs',
        },
        (payload) => {
          console.log('Nutrition log changed:', payload);
          // Trigger sync if we have pending changes
          if (this.pendingChanges.length > 0) {
            this.syncPendingChanges();
          }
        }
      )
      .subscribe();

    // Sync on page visibility change (user returns to app)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.syncPendingChanges();
      }
    });

    // Sync on network reconnection
    window.addEventListener('online', () => {
      this.syncPendingChanges();
    });

    // Initial sync
    await this.syncPendingChanges();
  }

  async addPendingChange(change: Omit<PendingChange, 'id' | 'timestamp' | 'synced'>) {
    const pendingChange: PendingChange = {
      ...change,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      synced: false,
    };

    this.pendingChanges.push(pendingChange);
    await this.savePendingChanges();

    // Trigger immediate sync attempt
    this.syncPendingChanges();
  }

  async syncPendingChanges() {
    if (this.isSyncing || !navigator.onLine) {
      return;
    }

    this.isSyncing = true;

    try {
      const unsynced = this.pendingChanges.filter((c) => !c.synced);

      for (const change of unsynced) {
        try {
          if (change.operation === 'insert') {
            await this.supabase.from(change.table).insert(change.data);
          } else if (change.operation === 'update') {
            await this.supabase
              .from(change.table)
              .update(change.data)
              .eq('id', change.data.id);
          } else if (change.operation === 'delete') {
            await this.supabase.from(change.table).delete().eq('id', change.data.id);
          }

          // Mark as synced
          change.synced = true;
        } catch (error) {
          console.error('Failed to sync change:', error);
          // Keep in pending queue for retry
        }
      }

      // Remove synced changes
      this.pendingChanges = this.pendingChanges.filter((c) => !c.synced);
      await this.savePendingChanges();
    } finally {
      this.isSyncing = false;
    }
  }

  private async loadPendingChanges() {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('pending_changes');
      if (stored) {
        this.pendingChanges = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load pending changes:', error);
    }
  }

  private async savePendingChanges() {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('pending_changes', JSON.stringify(this.pendingChanges));
    } catch (error) {
      console.error('Failed to save pending changes:', error);
    }
  }

  destroy() {
    if (this.realtimeChannel) {
      this.supabase.removeChannel(this.realtimeChannel);
    }

    document.removeEventListener('visibilitychange', this.syncPendingChanges);
    window.removeEventListener('online', this.syncPendingChanges);
  }
}

// Singleton instance
let syncServiceInstance: SyncService | null = null;

export function getSyncService(): SyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new SyncService();
  }
  return syncServiceInstance;
}
```

#### Testing

**File**: `src/lib/pwa/__tests__/sync-service.test.ts`

```typescript
import { SyncService } from '../sync-service';
import { createClient } from '@/utils/supabase/client';

jest.mock('@/utils/supabase/client');

describe('SyncService with Real-time', () => {
  let syncService: SyncService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      channel: jest.fn().mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
      }),
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      removeChannel: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    syncService = new SyncService();
  });

  afterEach(() => {
    syncService.destroy();
  });

  it('initializes with real-time subscription', async () => {
    await syncService.init();

    expect(mockSupabase.channel).toHaveBeenCalledWith('nutrition_logs_sync');
  });

  it('adds pending change and attempts sync', async () => {
    await syncService.init();

    await syncService.addPendingChange({
      table: 'nutrition_logs',
      operation: 'insert',
      data: { food_items: 'Test meal' },
    });

    // Should call insert
    expect(mockSupabase.from).toHaveBeenCalledWith('nutrition_logs');
  });

  it('syncs on visibility change', async () => {
    await syncService.init();

    const syncSpy = jest.spyOn(syncService, 'syncPendingChanges');

    // Simulate tab becoming visible
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
    });

    document.dispatchEvent(new Event('visibilitychange'));

    expect(syncSpy).toHaveBeenCalled();
  });

  it('syncs on network reconnection', async () => {
    await syncService.init();

    const syncSpy = jest.spyOn(syncService, 'syncPendingChanges');

    window.dispatchEvent(new Event('online'));

    expect(syncSpy).toHaveBeenCalled();
  });
});
```

---

### Task 8.4.2: Create StatusAlert Component

**Problem**: Alert pattern repeated 8+ times with inline styling logic.

**Current Pattern** (repeated in 8+ files):

```typescript
<Alert className={`mb-6 ${
  message.type === "error"
    ? "border-red-200 bg-red-50 text-red-800"
    : "border-green-200 bg-green-50 text-green-800"
}`}>
  <AlertDescription>{message.text}</AlertDescription>
</Alert>
```

**Solution**: Create reusable StatusAlert component (already created in Phase 8.1).

#### Files to Create

**File**: `src/components/ui/status-alert.tsx`

```typescript
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertVariant = 'error' | 'success' | 'warning' | 'info' | 'destructive';

interface StatusAlertProps {
  variant: AlertVariant;
  title?: string;
  message: string;
  className?: string;
  onClose?: () => void;
}

const variantConfig = {
  error: {
    icon: XCircle,
    className: 'border-destructive/50 bg-destructive/10 text-destructive dark:border-destructive',
    iconClassName: 'text-destructive',
  },
  destructive: {
    icon: AlertCircle,
    className: 'border-destructive/50 bg-destructive/10 text-destructive dark:border-destructive',
    iconClassName: 'text-destructive',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-chart-1/50 bg-chart-1/10 text-chart-1 dark:border-chart-1',
    iconClassName: 'text-chart-1',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-chart-4/50 bg-chart-4/10 text-chart-4 dark:border-chart-4',
    iconClassName: 'text-chart-4',
  },
  info: {
    icon: Info,
    className: 'border-chart-2/50 bg-chart-2/10 text-chart-2 dark:border-chart-2',
    iconClassName: 'text-chart-2',
  },
};

export function StatusAlert({
  variant,
  title,
  message,
  className,
  onClose,
}: StatusAlertProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <Alert className={cn(config.className, className)}>
      <Icon className={cn('h-4 w-4', config.iconClassName)} />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="flex items-center justify-between">
        <span>{message}</span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-4 hover:opacity-70 transition-opacity"
            aria-label="Dismiss alert"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </AlertDescription>
    </Alert>
  );
}
```

#### Files to Update

**File 1**: `src/app/reset-password/page.tsx`

```typescript
// Before:
{message && (
  <Alert className={`mb-6 ${
    message.type === "error"
      ? "border-red-200 bg-red-50"
      : "border-green-200 bg-green-50"
  }`}>
    <AlertDescription className={
      message.type === "error" ? "text-red-800" : "text-green-800"
    }>
      {message.text}
    </AlertDescription>
  </Alert>
)}

// After:
import { StatusAlert } from '@/components/ui/status-alert'

{message && (
  <StatusAlert
    variant={message.type}
    message={message.text}
    className="mb-6"
  />
)}
```

**File 2**: `src/app/login/page.tsx`
**File 3**: `src/components/calorie-tracker/photo-upload.tsx`
**File 4**: `src/components/settings/withings-connection.tsx`
**File 5-8**: Other files with alert patterns

#### Testing

**File**: `src/components/ui/__tests__/status-alert.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusAlert } from '../status-alert';

describe('StatusAlert', () => {
  it('renders error variant correctly', () => {
    render(<StatusAlert variant="error" message="Error message" />);

    expect(screen.getByText('Error message')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('border-destructive/50');
    expect(alert).toHaveClass('bg-destructive/10');
  });

  it('renders success variant correctly', () => {
    render(<StatusAlert variant="success" message="Success message" />);

    expect(screen.getByText('Success message')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('border-chart-1/50');
    expect(alert).toHaveClass('bg-chart-1/10');
  });

  it('renders with title when provided', () => {
    render(
      <StatusAlert variant="info" title="Important" message="Info message" />
    );

    expect(screen.getByText('Important')).toBeInTheDocument();
    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('calls onClose when dismiss button clicked', () => {
    const handleClose = jest.fn();
    render(
      <StatusAlert variant="warning" message="Warning" onClose={handleClose} />
    );

    const dismissButton = screen.getByLabelText('Dismiss alert');
    fireEvent.click(dismissButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not show dismiss button when onClose not provided', () => {
    render(<StatusAlert variant="info" message="Info" />);

    expect(screen.queryByLabelText('Dismiss alert')).not.toBeInTheDocument();
  });
});
```

---

### Task 8.4.3: Improve Error Handling Patterns

**Problem**: Inconsistent error handling across components and API routes.

**Solution**: Create ErrorBoundary and standardized error utilities.

#### Files to Create

**File**: `src/components/error-boundary.tsx`

```typescript
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { StatusAlert } from '@/components/ui/status-alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Home, AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error reporting service (e.g., Sentry)
    console.error('Error boundary caught:', error, errorInfo);

    this.setState({ errorInfo });

    // TODO: Send to error tracking service
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(error, { contexts: { react: errorInfo } });
    // }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleGoHome = () => {
    window.location.href = '/app';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-8 app-gradient-bg">
          <Card variant="glass" className="max-w-2xl w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-6 h-6" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatusAlert
                variant="error"
                title="Error Details"
                message={
                  this.state.error?.message ||
                  'An unexpected error occurred. Please try again.'
                }
              />

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mt-4 p-4 bg-muted rounded-lg">
                  <summary className="cursor-pointer font-medium text-sm">
                    Technical Details (Development Only)
                  </summary>
                  <pre className="mt-2 text-xs overflow-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex gap-3">
                <Button onClick={this.handleReset} className="flex-1">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={this.handleGoHome} variant="outline" className="flex-1">
                  <Home className="w-4 h-4 mr-2" />
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**File**: `src/lib/errors.ts`

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 'RATE_LIMIT', 429);
    this.name = 'RateLimitError';
  }
}

export function handleApiError(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred';
}

export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    (error.message.includes('fetch') || error.message.includes('network'))
  );
}

export function getErrorStatusCode(error: unknown): number {
  if (error instanceof AppError) {
    return error.statusCode || 500;
  }
  return 500;
}

export function formatErrorForClient(error: unknown): {
  message: string;
  code?: string;
  details?: Record<string, any>;
} {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'INTERNAL_ERROR',
    };
  }

  return {
    message: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
  };
}
```

#### Files to Update

**File**: `src/app/app/layout.tsx`

Wrap children in ErrorBoundary:

```typescript
import { ErrorBoundary } from '@/components/error-boundary'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // ... existing code ...

  return (
    <div className="min-h-screen app-gradient-bg">
      <AppNavigation user={user} />
      <ErrorBoundary>
        <main className="container mx-auto px-4 py-8 pb-20 md:pb-8">
          {children}
        </main>
      </ErrorBoundary>
      <MobileNavigation />
      <Toaster />
    </div>
  )
}
```

**File**: Example API route with error handling

`src/app/api/nutrition/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  handleApiError,
  getErrorStatusCode,
  formatErrorForClient,
} from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new AuthenticationError();
    }

    // Parse request body
    const body = await request.json();

    // Validate input
    if (!body.food_items) {
      throw new ValidationError('food_items is required', {
        field: 'food_items',
      });
    }

    // Process request...
    const { data, error } = await supabase
      .from('nutrition_logs')
      .insert({
        user_id: user.id,
        food_items: body.food_items,
        // ... other fields
      })
      .select()
      .single();

    if (error) {
      throw new AppError('Failed to create nutrition log', 'DATABASE_ERROR', 500);
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);

    const statusCode = getErrorStatusCode(error);
    const errorResponse = formatErrorForClient(error);

    return NextResponse.json(errorResponse, { status: statusCode });
  }
}
```

#### Testing

**File**: `src/lib/__tests__/errors.test.ts`

```typescript
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
```

---

### Task 8.4.4: Code Organization and Cleanup

**Problem**: Some files have grown too large or have mixed concerns.

**Solution**: Extract logical components and utilities.

#### Example: Extract sync status utilities

**File**: `src/lib/sync-helpers.ts`

```typescript
export function formatSyncTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

  return date.toLocaleDateString();
}

export function getSyncStatusColor(
  status: 'pending' | 'success' | 'error'
): string {
  switch (status) {
    case 'pending':
      return 'text-primary';
    case 'success':
      return 'text-chart-1';
    case 'error':
      return 'text-destructive';
  }
}

export function getSyncStatusBadgeVariant(
  status: 'pending' | 'success' | 'error'
): 'info' | 'success' | 'destructive' {
  switch (status) {
    case 'pending':
      return 'info';
    case 'success':
      return 'success';
    case 'error':
      return 'destructive';
  }
}
```

---

## Implementation Checklist

### Task 8.4.1: Replace Polling with Real-time
- [ ] Create database migration `supabase/migrations/*_enable_realtime_withings.sql`
- [ ] Run migration: `supabase db push`
- [ ] Update `src/components/settings/withings-sync-status.tsx` with real-time
- [ ] Update `src/lib/pwa/sync-service.ts` with real-time + Visibility API
- [ ] Remove all setInterval calls from both files
- [ ] Create test file `src/components/settings/__tests__/withings-sync-status.test.tsx`
- [ ] Create test file `src/lib/pwa/__tests__/sync-service.test.ts`
- [ ] Run tests: `npm test withings-sync-status.test.tsx sync-service.test.ts`
- [ ] Manual test: Start sync, verify immediate updates
- [ ] Test: Close tab, reopen, verify sync continues
- [ ] Test: Go offline, come online, verify sync resumes
- [ ] Verify no polling in Network tab (DevTools)

### Task 8.4.2: Create StatusAlert Component
- [ ] Create `src/components/ui/status-alert.tsx` (if not exists from Phase 8.1)
- [ ] Update `src/app/reset-password/page.tsx` to use StatusAlert
- [ ] Update `src/app/login/page.tsx` to use StatusAlert
- [ ] Update `src/components/calorie-tracker/photo-upload.tsx` to use StatusAlert
- [ ] Update `src/components/settings/withings-connection.tsx` to use StatusAlert
- [ ] Search for remaining inline alert patterns: `rg "border-red-200 bg-red-50" src/`
- [ ] Update any remaining files found
- [ ] Create test file `src/components/ui/__tests__/status-alert.test.tsx`
- [ ] Run tests: `npm test status-alert.test.tsx`
- [ ] Verify all alert variants display correctly

### Task 8.4.3: Improve Error Handling
- [ ] Create `src/components/error-boundary.tsx`
- [ ] Create `src/lib/errors.ts` with error classes
- [ ] Update `src/app/app/layout.tsx` to wrap children in ErrorBoundary
- [ ] Update API route `src/app/api/nutrition/route.ts` (example)
- [ ] Update other API routes with consistent error handling
- [ ] Create test file `src/lib/__tests__/errors.test.ts`
- [ ] Run tests: `npm test errors.test.ts`
- [ ] Manual test: Trigger error, verify ErrorBoundary displays
- [ ] Manual test: Click "Try Again", verify recovery
- [ ] Test API errors return proper status codes

### Task 8.4.4: Code Organization
- [ ] Create `src/lib/sync-helpers.ts` with sync utilities
- [ ] Review large files (>500 lines) for extraction opportunities
- [ ] Extract reusable logic into utility files
- [ ] Add JSDoc comments to utility functions
- [ ] Update imports in affected files

### Final Verification
- [ ] Run full test suite: `npm test`
- [ ] Run linter: `npm run lint`
- [ ] Build production: `npm run build`
- [ ] Search for setInterval: `rg "setInterval" src/` (should only find service worker)
- [ ] Verify real-time updates work (<500ms latency)
- [ ] Check Network tab - no polling requests
- [ ] Test error scenarios with ErrorBoundary
- [ ] Test offline/online sync behavior
- [ ] Commit changes with descriptive message

---

## Files Created (9 new files)

1. `supabase/migrations/*_enable_realtime_withings.sql`
2. `src/components/error-boundary.tsx`
3. `src/lib/errors.ts`
4. `src/lib/sync-helpers.ts`
5. `src/components/settings/__tests__/withings-sync-status.test.tsx`
6. `src/lib/pwa/__tests__/sync-service.test.ts`
7. `src/components/ui/__tests__/status-alert.test.tsx`
8. `src/lib/__tests__/errors.test.ts`
9. `src/components/ui/status-alert.tsx` (if not created in Phase 8.1)

## Files Modified (12+ files)

1. `src/components/settings/withings-sync-status.tsx` (complete rewrite)
2. `src/lib/pwa/sync-service.ts` (complete rewrite)
3. `src/app/app/layout.tsx` (wrap in ErrorBoundary)
4. `src/app/reset-password/page.tsx` (use StatusAlert)
5. `src/app/login/page.tsx` (use StatusAlert)
6. `src/components/calorie-tracker/photo-upload.tsx` (use StatusAlert)
7. `src/components/settings/withings-connection.tsx` (use StatusAlert)
8. `src/app/api/nutrition/route.ts` (example API error handling)
9. All other API routes (consistent error handling)
10. Files with inline alert patterns (discovered during audit)

---

## Time Estimate

- Task 8.4.1 (Replace Polling with Real-time): 12-16 hours
  - withings-sync-status rewrite: 4-6 hours
  - sync-service rewrite: 4-6 hours
  - Database migration: 1-2 hours
  - Testing: 3-4 hours
- Task 8.4.2 (StatusAlert Component): 3-4 hours
- Task 8.4.3 (Error Handling): 6-8 hours
  - ErrorBoundary: 2-3 hours
  - Error utilities: 2-3 hours
  - API routes: 2-3 hours
- Task 8.4.4 (Code Organization): 4-6 hours
- Testing and verification: 4-6 hours

**Total: 29-40 hours**

---

## Success Metrics

After completing Phase 8.4:
- 0 polling instances (setInterval removed from 2 files)
- Real-time updates working (<500ms latency)
- StatusAlert component used in 8+ files (was inline everywhere)
- ErrorBoundary protecting all app routes
- Consistent error handling in all API routes
- Battery impact reduced by ~70% (no polling)
- All tests passing
- Production build successful