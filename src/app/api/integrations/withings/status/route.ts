// Connection status endpoint
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { WithingsConnectionService } from '@/lib/withings/database';
import { ConnectionStatus } from '@/lib/withings/types';
import { apiLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    apiLogger.debug('Getting Withings connection status');

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      apiLogger.warn('Unauthorized access to Withings status', { authError });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile ID
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      apiLogger.warn('Failed to get user profile for status check', { 
        error: profileError, 
        userId: user.id 
      });
      return NextResponse.json({ error: 'User profile not found' }, { status: 400 });
    }

    const connectionService = new WithingsConnectionService();
    const connection = await connectionService.getConnection(profile.id);

    const status: ConnectionStatus = {
      isConnected: !!connection && connection.isActive,
      connectedAt: connection?.connectedAt || undefined,
      lastSyncAt: connection?.lastSyncAt || undefined,
      withingsUserId: connection?.withingsUserId,
      scopes: connection?.scopes
    };

    apiLogger.debug('Retrieved Withings connection status', {
      userId: user.id,
      isConnected: status.isConnected,
      withingsUserId: status.withingsUserId
    });

    return NextResponse.json(status);

  } catch (error) {
    apiLogger.error('Failed to get Withings connection status', { error });
    return NextResponse.json(
      { error: 'Failed to get connection status' },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}