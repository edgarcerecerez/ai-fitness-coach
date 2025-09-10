// OAuth flow initiation endpoint
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { WithingsAuthService } from '@/lib/withings/auth';
import { WithingsConnectionService } from '@/lib/withings/database';
import { apiLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    apiLogger.debug('Initiating Withings OAuth flow');

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      apiLogger.warn('Unauthorized access to Withings auth initiate', { authError });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile ID
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      apiLogger.error('Failed to get user profile for Withings auth', { 
        error: profileError, 
        userId: user.id 
      });
      return NextResponse.json({ error: 'User profile not found' }, { status: 400 });
    }

    // Check if user already has an active connection
    const connectionService = new WithingsConnectionService();
    const existingConnection = await connectionService.getConnection(profile.id);

    if (existingConnection && existingConnection.isActive) {
      apiLogger.info('User already has active Withings connection', {
        userId: user.id,
        connectionId: existingConnection.id
      });
      return NextResponse.json({ 
        error: 'Withings account already connected' 
      }, { status: 400 });
    }

    const authService = new WithingsAuthService();
    const { authUrl, state, codeVerifier } = authService.generateAuthUrl(profile.id);

    // Store PKCE code verifier temporarily (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await connectionService.storeAuthState(
      `${profile.id}:${state}`,
      profile.id,
      codeVerifier,
      expiresAt
    );

    apiLogger.info('Successfully initiated Withings OAuth flow', {
      userId: user.id,
      profileId: profile.id,
      expiresAt: expiresAt.toISOString()
    });

    return NextResponse.json({ 
      authUrl, 
      state: `${profile.id}:${state}` 
    });

  } catch (error: unknown) {
    apiLogger.error('Withings auth initiation failed', { error });
    return NextResponse.json(
      { error: 'Failed to initiate authentication' },
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}