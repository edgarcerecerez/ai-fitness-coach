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
