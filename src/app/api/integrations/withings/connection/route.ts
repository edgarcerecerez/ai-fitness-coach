// Connection management endpoint
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { WithingsConnectionService } from '@/lib/withings/database';
import { WithingsAuthService } from '@/lib/withings/auth';
import { WithingsApiClient } from '@/lib/withings/client';
import { apiLogger } from '@/lib/logger';

export async function DELETE(request: NextRequest) {
  try {
    apiLogger.debug('Disconnecting Withings account');

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      apiLogger.warn('Unauthorized access to Withings disconnect', { authError });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile ID
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      apiLogger.error('Failed to get user profile for disconnect', { 
        error: profileError, 
        userId: user.id 
      });
      return NextResponse.json({ error: 'User profile not found' }, { status: 400 });
    }

    const connectionService = new WithingsConnectionService();
    const connection = await connectionService.getConnection(profile.id);

    if (!connection || !connection.isActive) {
      apiLogger.warn('No active Withings connection to disconnect', {
        userId: user.id,
        hasConnection: !!connection,
        isActive: connection?.isActive
      });
      return NextResponse.json({ 
        error: 'No active Withings connection found' 
      }, { status: 400 });
    }

    // Try to revoke the token with Withings (best effort)
    try {
      const authService = new WithingsAuthService();
      await authService.revokeToken(connection.accessToken);
      apiLogger.info('Successfully revoked Withings token', {
        connectionId: connection.id
      });
    } catch (revokeError) {
      // Log but don't fail the disconnect process
      apiLogger.warn('Failed to revoke token with Withings, proceeding with local disconnect', {
        connectionId: connection.id,
        error: revokeError
      });
    }

    // Deactivate the connection
    await connectionService.deactivateConnection(profile.id);

    apiLogger.info('Successfully disconnected Withings account', {
      userId: user.id,
      connectionId: connection.id,
      withingsUserId: connection.withingsUserId
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Withings account disconnected successfully' 
    });

  } catch (error: unknown) {
    apiLogger.error('Failed to disconnect Withings account', { error });
    return NextResponse.json(
      { error: 'Failed to disconnect Withings account' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    apiLogger.debug('Testing Withings connection');

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      apiLogger.warn('Unauthorized access to Withings test', { authError });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile ID
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      apiLogger.error('Failed to get user profile for connection test', { 
        error: profileError, 
        userId: user.id 
      });
      return NextResponse.json({ error: 'User profile not found' }, { status: 400 });
    }

    const connectionService = new WithingsConnectionService();
    const connection = await connectionService.getConnection(profile.id);

    if (!connection || !connection.isActive) {
      apiLogger.warn('No active Withings connection to test', {
        userId: user.id,
        hasConnection: !!connection,
        isActive: connection?.isActive
      });
      return NextResponse.json({ 
        error: 'No active Withings connection found' 
      }, { status: 400 });
    }

    // Test the connection
    const apiClient = new WithingsApiClient();
    const isWorking = await apiClient.testConnection(profile.id);

    if (!isWorking) {
      apiLogger.warn('Withings connection test failed', {
        userId: user.id,
        connectionId: connection.id
      });
      return NextResponse.json({
        success: false,
        error: 'Connection test failed'
      }, { status: 400 });
    }

    apiLogger.info('Withings connection test successful', {
      userId: user.id,
      connectionId: connection.id
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Connection is working properly',
      connectionInfo: {
        connectedAt: connection.connectedAt,
        lastSyncAt: connection.lastSyncAt,
        withingsUserId: connection.withingsUserId,
        scopes: connection.scopes
      }
    });

  } catch (error: unknown) {
    apiLogger.error('Failed to test Withings connection', { error });
    return NextResponse.json(
      { error: 'Failed to test connection' },
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
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}