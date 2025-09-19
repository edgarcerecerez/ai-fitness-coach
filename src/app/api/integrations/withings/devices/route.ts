import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { WithingsDeviceManager } from '@/lib/withings/device-manager';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deviceManager = new WithingsDeviceManager();
    const devices = await deviceManager.getDevicesForUser(user.id);

    return NextResponse.json({ devices });
  } catch (error) {
    console.error('Failed to get devices:', error);
    return NextResponse.json({ error: 'Failed to get devices' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, deviceId, enabled } = body;

    const deviceManager = new WithingsDeviceManager();

    switch (action) {
      case 'refresh':
        try {
          const devices = await deviceManager.updateDevicesForUser(user.id);
          return NextResponse.json({ devices, success: true });
        } catch (error) {
          console.error('Failed to refresh devices:', error);
          return NextResponse.json({ 
            error: 'Failed to refresh devices', 
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      
      case 'toggle_notifications':
        if (!deviceId || typeof enabled !== 'boolean') {
          return NextResponse.json({ 
            error: 'Invalid parameters', 
            required: { deviceId: 'string', enabled: 'boolean' }
          }, { status: 400 });
        }
        
        try {
          await deviceManager.toggleDeviceNotifications(user.id, deviceId, enabled);
          return NextResponse.json({ success: true });
        } catch (error) {
          console.error('Failed to toggle device notifications:', error);
          return NextResponse.json({ 
            error: 'Failed to toggle device notifications',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      
      default:
        return NextResponse.json({ 
          error: 'Invalid action', 
          validActions: ['refresh', 'toggle_notifications']
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Device management error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}