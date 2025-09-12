import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ConflictResolver } from '@/lib/withings/conflict-resolver';
import { apiLogger } from '@/lib/logger';

const conflictResolver = new ConflictResolver();

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get unresolved conflicts
    const conflicts = await conflictResolver.getUnresolvedConflicts(user.id);
    
    // Get conflict statistics
    const stats = await conflictResolver.getConflictStats(user.id);

    return NextResponse.json({
      conflicts,
      stats
    });
  } catch (error) {
    apiLogger.error('Conflicts API GET error', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return NextResponse.json(
      { error: 'Failed to fetch conflicts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { conflictId, resolution } = body;

    if (!conflictId || !resolution) {
      return NextResponse.json(
        { error: 'conflictId and resolution are required' },
        { status: 400 }
      );
    }

    // Validate resolution strategy
    const validResolutions = ['keep_existing', 'use_withings', 'merge'];
    if (!validResolutions.includes(resolution)) {
      return NextResponse.json(
        { error: `Invalid resolution. Must be one of: ${validResolutions.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify the conflict belongs to the user
    const { data: conflict } = await supabase
      .from('withings_data_conflicts')
      .select('id')
      .eq('id', conflictId)
      .eq('user_id', user.id)
      .single();

    if (!conflict) {
      return NextResponse.json(
        { error: 'Conflict not found or access denied' },
        { status: 404 }
      );
    }

    await conflictResolver.resolveConflict(conflictId, resolution, user.id);

    apiLogger.info('Conflict resolved by user', {
      userId: user.id,
      conflictId,
      resolution
    });

    return NextResponse.json({
      message: 'Conflict resolved successfully',
      conflictId,
      resolution
    });
  } catch (error) {
    apiLogger.error('Conflicts API POST error', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return NextResponse.json(
      { error: 'Failed to resolve conflict' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'auto_resolve') {
      // Auto-resolve conflicts based on strategy
      const resolvedCount = await conflictResolver.autoResolveConflicts(user.id);
      
      apiLogger.info('Auto-resolved conflicts', {
        userId: user.id,
        resolvedCount
      });

      return NextResponse.json({
        message: `Auto-resolved ${resolvedCount} conflicts`,
        resolvedCount
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Supported actions: auto_resolve' },
      { status: 400 }
    );
  } catch (error) {
    apiLogger.error('Conflicts API PUT error', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return NextResponse.json(
      { error: 'Failed to process conflicts action' },
      { status: 500 }
    );
  }
}