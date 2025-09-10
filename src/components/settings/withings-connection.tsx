'use client';

// UI component for managing Withings connection
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wifi, WifiOff, TestTube, Unlink, ExternalLink } from 'lucide-react';
import { ConnectionStatus } from '@/lib/withings/types';
import { useToast } from '@/hooks/use-toast';

interface WithingsConnectionProps {
  onConnectionChange?: (isConnected: boolean) => void;
}

export function WithingsConnection({ onConnectionChange }: WithingsConnectionProps) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConnectionStatus();
    
    // Check for OAuth callback results in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('withings_connected');
    const error = urlParams.get('withings_error');
    
    if (connected === 'true') {
      toast({
        title: 'Success',
        description: 'Withings account connected successfully!',
      });
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
      loadConnectionStatus();
    } else if (error) {
      let errorMessage = 'Failed to connect Withings account';
      switch (error) {
        case 'access_denied':
          errorMessage = 'Connection was cancelled or access was denied';
          break;
        case 'invalid_state':
          errorMessage = 'Invalid security state. Please try again';
          break;
        case 'connection_failed':
          errorMessage = 'Failed to establish connection with Withings';
          break;
        case 'missing_parameters':
          errorMessage = 'Missing required parameters from Withings';
          break;
      }
      
      toast({
        title: 'Connection Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast]);

  const loadConnectionStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/integrations/withings/status');
      
      if (!response.ok) {
        throw new Error('Failed to load connection status');
      }
      
      const connectionStatus: ConnectionStatus = await response.json();
      setStatus(connectionStatus);
      onConnectionChange?.(connectionStatus.isConnected);
    } catch (error) {
      console.error('Failed to load Withings connection status:', error);
      toast({
        title: 'Error',
        description: 'Failed to load Withings connection status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const response = await fetch('/api/integrations/withings/auth/initiate', {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate connection');
      }
      
      const { authUrl } = await response.json();
      
      // Redirect to Withings OAuth
      window.location.href = authUrl;
    } catch (error: unknown) {
      console.error('Failed to initiate Withings connection:', error);
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to start connection process',
        variant: 'destructive',
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      const response = await fetch('/api/integrations/withings/connection', {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Connection test failed');
      }
      
      const result = await response.json();
      
      toast({
        title: 'Connection Test',
        description: result.message || 'Connection is working properly!',
      });
    } catch (error: unknown) {
      console.error('Connection test failed:', error);
      toast({
        title: 'Test Failed',
        description: error instanceof Error ? error.message : 'Connection test failed',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Withings account? This will stop syncing weight data.')) {
      return;
    }
    
    try {
      setDisconnecting(true);
      const response = await fetch('/api/integrations/withings/connection', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to disconnect');
      }
      
      toast({
        title: 'Disconnected',
        description: 'Withings account disconnected successfully',
      });
      
      await loadConnectionStatus();
    } catch (error: unknown) {
      console.error('Failed to disconnect Withings:', error);
      toast({
        title: 'Disconnection Failed',
        description: error instanceof Error ? error.message : 'Failed to disconnect Withings account',
        variant: 'destructive',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-blue-600 rounded-full" />
            </div>
            Withings Smart Scale
          </CardTitle>
          <CardDescription>
            Connect your Withings smart scale to automatically sync weight data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
            <div className="w-3 h-3 bg-blue-600 rounded-full" />
          </div>
          Withings Smart Scale
        </CardTitle>
        <CardDescription>
          Connect your Withings smart scale to automatically sync weight data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status?.isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Connected</span>
                <Badge variant="success">Active</Badge>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium">Not Connected</span>
                <Badge variant="secondary">Inactive</Badge>
              </>
            )}
          </div>
        </div>

        {/* Connection Details */}
        {status?.isConnected && (
          <div className="space-y-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            {status.connectedAt && (
              <div>
                <span className="font-medium">Connected:</span> {formatDate(status.connectedAt)}
              </div>
            )}
            {status.lastSyncAt && (
              <div>
                <span className="font-medium">Last Sync:</span> {formatDate(status.lastSyncAt)}
              </div>
            )}
            {status.withingsUserId && (
              <div>
                <span className="font-medium">Withings User ID:</span> {status.withingsUserId}
              </div>
            )}
            {status.scopes && status.scopes.length > 0 && (
              <div>
                <span className="font-medium">Permissions:</span>{' '}
                <div className="flex flex-wrap gap-1 mt-1">
                  {status.scopes.map((scope) => (
                    <Badge key={scope} variant="outline" className="text-xs">
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {status?.isConnected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testing}
                className="flex items-center gap-2"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
                Test Connection
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 text-red-600 hover:text-red-700"
              >
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-2"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Connect Withings
            </Button>
          )}
        </div>

        {/* Help Text */}
        <div className="text-xs text-gray-500 bg-blue-50 rounded-lg p-3">
          <p className="font-medium mb-1">What this enables:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Automatic weight data sync from your Withings scale</li>
            <li>Historical weight data import</li>
            <li>Real-time updates when you weigh yourself</li>
            <li>Integration with your fitness tracking and AI recommendations</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}