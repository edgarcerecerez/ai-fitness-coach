// OAuth callback handler
import { NextRequest, NextResponse } from 'next/server';
import { WithingsAuthService } from '@/lib/withings/auth';
import { WithingsConnectionService } from '@/lib/withings/database';
import { apiLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    apiLogger.debug('Withings OAuth callback received', {
      hasCode: !!code,
      hasState: !!state,
      error
    });

    if (error) {
      apiLogger.warn('OAuth callback received error parameter', { error });
      return NextResponse.redirect(
        new URL(`/profile?withings_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code || !state) {
      apiLogger.warn('OAuth callback missing required parameters', { 
        hasCode: !!code, 
        hasState: !!state 
      });
      return NextResponse.redirect(
        new URL('/profile?withings_error=missing_parameters', request.url)
      );
    }

    const connectionService = new WithingsConnectionService();

    // Get and consume auth state
    const authState = await connectionService.getAndConsumeAuthState(state);

    if (!authState) {
      apiLogger.warn('Invalid or expired OAuth state', { state });
      return NextResponse.redirect(
        new URL('/profile?withings_error=invalid_state', request.url)
      );
    }

    // Additional state validation - extract user ID from state
    const [stateUserId] = state.split(':');
    if (stateUserId !== authState.user_id) {
      apiLogger.warn('State user ID mismatch', {
        stateUserId,
        authStateUserId: authState.user_id
      });
      return NextResponse.redirect(
        new URL('/profile?withings_error=state_user_mismatch', request.url)
      );
    }

    // Exchange code for tokens
    const authService = new WithingsAuthService();
    const tokens = await authService.exchangeCodeForTokens(code, authState.code_verifier);

    // Store connection
    const connectionId = await connectionService.storeConnection(authState.user_id, tokens);

    apiLogger.info('Successfully completed Withings OAuth flow', {
      connectionId,
      userId: authState.user_id,
      withingsUserId: tokens.userId
    });

    return NextResponse.redirect(
      new URL('/profile?withings_connected=true', request.url)
    );

  } catch (error: unknown) {
    apiLogger.error('Withings OAuth callback failed', { error });
    return NextResponse.redirect(
      new URL('/profile?withings_error=connection_failed', request.url)
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