'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SyncJob {
  readonly id: string;
  readonly job_type: string;
  readonly status: string;
  readonly measurements_requested: number;
  readonly measurements_processed: number;
  readonly measurements_synced: number;
  readonly measurements_skipped: number;
  readonly error_message?: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly completed_at?: string;
}

export function SyncHistory() {
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    loadSyncHistory();
  }, [page, loadSyncHistory]);

  const loadSyncHistory = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/integrations/withings/sync?limit=${ITEMS_PER_PAGE}&offset=${(page - 1) * ITEMS_PER_PAGE}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load sync history');
      }

      const data = await response.json();
      setSyncJobs(data.syncJobs || []);
      setHasMore(data.syncJobs?.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Failed to load sync history:', error);
    } finally {
      setLoading(false);
    }
  }, [page]);

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
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateDuration = (job: SyncJob) => {
    if (!job.completed_at) return null;
    
    const start = new Date(job.created_at);
    const end = new Date(job.completed_at);
    const duration = Math.round((end.getTime() - start.getTime()) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.round(duration / 60)}m`;
    return `${Math.round(duration / 3600)}h`;
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync History</CardTitle>
      </CardHeader>
      <CardContent>
        {syncJobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No sync history</p>
            <p className="text-sm">Sync jobs will appear here once you start syncing data</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Results</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(job.status)}
                        <span className="font-medium">
                          {formatJobType(job.job_type)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(job.status)}
                    </TableCell>
                    <TableCell>
                      {job.status === 'completed' ? (
                        <div className="text-sm">
                          <div className="text-green-600 font-medium">
                            {job.measurements_synced} synced
                          </div>
                          {job.measurements_skipped > 0 && (
                            <div className="text-yellow-600">
                              {job.measurements_skipped} skipped
                            </div>
                          )}
                        </div>
                      ) : job.status === 'processing' ? (
                        <div className="text-sm text-blue-600">
                          {job.measurements_processed} / {job.measurements_requested}
                        </div>
                      ) : job.status === 'failed' ? (
                        <div className="text-sm text-red-600">
                          Failed
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          Queued
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-600">
                        {calculateDuration(job) || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-600">
                        {formatDate(job.created_at)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              
              <span className="text-sm text-gray-600">
                Page {page}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={!hasMore}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}