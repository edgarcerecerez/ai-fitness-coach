'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Calendar,
  Activity,
  TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SyncJob {
  id: string;
  job_type: string;
  status: string;
  measurements_requested: number;
  measurements_processed: number;
  measurements_synced: number;
  measurements_skipped: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

interface ConflictStats {
  total: number;
  resolved: number;
  pending: number;
}

interface SyncStatusData {
  syncJobs: SyncJob[];
  conflictStats: ConflictStats;
}

export function WithingsSyncStatus() {
  const [syncData, setSyncData] = useState<SyncStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSyncStatus();
    
    // Auto-refresh every 30 seconds if there are active jobs
    const interval = setInterval(() => {
      if (syncData?.syncJobs.some(job => job.status === 'processing' || job.status === 'pending')) {
        loadSyncStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [syncData?.syncJobs, loadSyncStatus]);

  const loadSyncStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/integrations/withings/sync');
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Not authenticated');
        }
        throw new Error('Failed to load sync status');
      }

      const data = await response.json();
      setSyncData(data);
    } catch (error) {
      console.error('Failed to load sync status:', error);
      toast({
        title: 'Error',
        description: 'Failed to load sync status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const triggerManualSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/integrations/withings/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          syncType: 'manual'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start sync');
      }

      await response.json();
      
      toast({
        title: 'Sync Started',
        description: 'Manual sync has been queued and will complete shortly.',
      });

      // Reload status after a brief delay
      setTimeout(() => {
        loadSyncStatus();
      }, 2000);

    } catch (error) {
      console.error('Manual sync failed:', error);
      toast({
        title: 'Sync Failed',
        description: 'Failed to start manual sync. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'secondary'> = {
      completed: 'default',
      failed: 'destructive',
      processing: 'secondary',
      pending: 'secondary'
    };

    return (
      <Badge variant={variants[status] || 'secondary'} className="capitalize">
        {status}
      </Badge>
    );
  };

  const formatJobType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const calculateProgress = (job: SyncJob) => {
    if (job.measurements_requested === 0) return 0;
    return Math.round((job.measurements_processed / job.measurements_requested) * 100);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const recentJob = syncData?.syncJobs[0];
  const hasActiveJobs = syncData?.syncJobs.some(
    job => job.status === 'processing' || job.status === 'pending'
  );

  return (
    <div className="space-y-4">
      {/* Current Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Sync Status</CardTitle>
              <CardDescription>
                Automatic synchronization with your Withings devices
              </CardDescription>
            </div>
            <Button 
              onClick={triggerManualSync}
              disabled={syncing || hasActiveJobs}
              size="sm"
            >
              {syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Manual Sync
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentJob ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(recentJob.status)}
                  <span className="font-medium">
                    {formatJobType(recentJob.job_type)} Sync
                  </span>
                  {getStatusBadge(recentJob.status)}
                </div>
                <span className="text-sm text-gray-500">
                  {formatDate(recentJob.created_at)}
                </span>
              </div>

              {recentJob.status === 'processing' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>
                      {recentJob.measurements_processed} / {recentJob.measurements_requested}
                    </span>
                  </div>
                  <Progress value={calculateProgress(recentJob)} className="h-2" />
                </div>
              )}

              {recentJob.status === 'completed' && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <div>
                      <div className="font-medium">{recentJob.measurements_synced}</div>
                      <div className="text-gray-500">Synced</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <div>
                      <div className="font-medium">{recentJob.measurements_processed}</div>
                      <div className="text-gray-500">Processed</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <div>
                      <div className="font-medium">{recentJob.measurements_skipped}</div>
                      <div className="text-gray-500">Skipped</div>
                    </div>
                  </div>
                </div>
              )}

              {recentJob.status === 'failed' && recentJob.error_message && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-start space-x-2">
                    <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                    <div className="text-sm text-red-800">
                      {recentJob.error_message}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sync history available</p>
              <p className="text-sm">Start a manual sync to begin tracking</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conflicts Card */}
      {syncData?.conflictStats && syncData.conflictStats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Data Conflicts</CardTitle>
            <CardDescription>
              Conflicts between manual entries and device data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {syncData.conflictStats.total}
                </div>
                <div className="text-sm text-gray-500">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {syncData.conflictStats.resolved}
                </div>
                <div className="text-sm text-gray-500">Resolved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {syncData.conflictStats.pending}
                </div>
                <div className="text-sm text-gray-500">Pending</div>
              </div>
            </div>
            
            {syncData.conflictStats.pending > 0 && (
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    // TODO: Navigate to conflicts resolution page
                    toast({
                      title: 'Coming Soon',
                      description: 'Conflict resolution interface is being implemented.',
                    });
                  }}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Review Conflicts
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}