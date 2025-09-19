import { NextRequest, NextResponse } from 'next/server';
import { WithingsWebhookSecurity } from '@/lib/withings/webhook-security';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-withings-signature');
    const timestamp = request.headers.get('x-withings-timestamp');
    
    if (!signature || !timestamp) {
      return NextResponse.json({ error: 'Missing signature or timestamp' }, { status: 400 });
    }

    const rawBody = await request.text();
    
    // Validate signature and timestamp
    const security = new WithingsWebhookSecurity();
    
    if (!security.isTimestampValid(timestamp)) {
      return NextResponse.json({ error: 'Invalid timestamp' }, { status: 400 });
    }

    if (!security.validateSignature(rawBody, signature, timestamp)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse and validate payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    
    const validation = security.validatePayload(payload);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Invalid payload', details: validation.errors }, { status: 400 });
    }

    // Generate unique webhook ID for deduplication
    const webhookId = `${payload.userid}_${payload.appli}_${payload.date}`;

    // Check for duplicate webhook
    const supabase = createClient();
    const { data: existing } = await supabase
      .from('withings_webhook_events')
      .select('id')
      .eq('webhook_id', webhookId)
      .single();

    if (existing) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Queue webhook for processing via Inngest
    try {
      const { inngest } = await import('@/lib/inngest/client');
      await inngest.send({
        name: 'withings/webhook.received',
        data: {
          webhookId,
          payload
        }
      });

      return NextResponse.json({ received: true });
    } catch (inngestError) {
      console.error('Failed to queue webhook via Inngest:', inngestError);
      
      // Fallback: process immediately (not ideal for production)
      try {
        const { WithingsWebhookProcessor } = await import('@/lib/withings/webhook-processor');
        const processor = new WithingsWebhookProcessor();
        
        // Process in background (fire and forget)
        processor.processWebhook(webhookId, payload).catch(error => {
          console.error('Background webhook processing failed:', error);
        });
        
        return NextResponse.json({ received: true, processing: 'fallback' });
      } catch (processingError) {
        console.error('Fallback processing also failed:', processingError);
        return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
      }
    }

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'withings-webhook-endpoint'
  });
}
