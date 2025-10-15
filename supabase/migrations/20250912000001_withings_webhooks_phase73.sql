-- Phase 7.3: Withings Webhooks & Real-time Updates
-- Database schema for webhook processing, device management, and notifications

-- Webhook processing log
CREATE TABLE withings_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id VARCHAR UNIQUE NOT NULL, -- Withings webhook ID for deduplication
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES withings_connections(id) ON DELETE CASCADE,
  event_type VARCHAR NOT NULL, -- 'measurement', 'device', 'user'
  application INTEGER NOT NULL, -- Withings application ID (1=weight, 4=circulatory, etc.)
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  notification_date TIMESTAMP WITH TIME ZONE NOT NULL,
  raw_payload JSONB NOT NULL,
  processing_status VARCHAR DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  processing_attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for webhook queries
CREATE INDEX idx_withings_webhooks_webhook_id ON withings_webhook_events(webhook_id);
CREATE INDEX idx_withings_webhooks_user_id ON withings_webhook_events(user_id);
CREATE INDEX idx_withings_webhooks_status ON withings_webhook_events(processing_status);
CREATE INDEX idx_withings_webhooks_created_at ON withings_webhook_events(created_at);
CREATE INDEX idx_withings_webhooks_pending ON withings_webhook_events(processing_status, created_at) WHERE processing_status = 'pending';

-- Enhanced device tracking - add columns to existing withings_devices table
ALTER TABLE withings_devices 
ADD COLUMN IF NOT EXISTS model_id INTEGER,
ADD COLUMN IF NOT EXISTS features TEXT[],
ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMP WITH TIME ZONE;

-- Notification preferences
CREATE TABLE withings_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  measurement_notifications BOOLEAN DEFAULT true,
  achievement_notifications BOOLEAN DEFAULT true,
  sync_failure_notifications BOOLEAN DEFAULT true,
  notification_methods TEXT[] DEFAULT '{"push"}', -- 'push', 'email'
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone VARCHAR DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Push notification tokens
CREATE TABLE user_notification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR NOT NULL, -- 'web', 'ios', 'android'
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(token)
);

CREATE INDEX idx_notification_tokens_user_id ON user_notification_tokens(user_id);
CREATE INDEX idx_notification_tokens_active ON user_notification_tokens(is_active);

-- Webhook subscription management
CREATE TABLE withings_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES withings_connections(id) ON DELETE CASCADE,
  withings_subscription_id VARCHAR,
  application INTEGER NOT NULL, -- 1=weight, 4=circulatory, 16=activity, 44=sleep
  callback_url TEXT NOT NULL,
  comment TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(connection_id, application)
);

-- Row Level Security (RLS) policies

-- Webhook events - users can only see their own
ALTER TABLE withings_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own webhook events" ON withings_webhook_events
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can manage webhook events" ON withings_webhook_events
  FOR ALL USING (true);

-- Notification preferences - users can only manage their own
ALTER TABLE withings_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notification preferences" ON withings_notification_preferences
  FOR ALL USING (user_id = auth.uid());

-- Notification tokens - users can only manage their own
ALTER TABLE user_notification_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notification tokens" ON user_notification_tokens
  FOR ALL USING (user_id = auth.uid());

-- Webhook subscriptions - users can view through connections
ALTER TABLE withings_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own webhook subscriptions" ON withings_webhook_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM withings_connections 
      WHERE withings_connections.id = connection_id 
      AND withings_connections.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage webhook subscriptions" ON withings_webhook_subscriptions
  FOR ALL USING (true);

-- Update triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_withings_notification_preferences_updated_at
  BEFORE UPDATE ON withings_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Webhook processing cleanup function (removes old webhook events)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS void AS $$
BEGIN
  DELETE FROM withings_webhook_events 
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND processing_status IN ('completed', 'failed');
END;
$$ LANGUAGE plpgsql;

-- Comment on tables and important columns
COMMENT ON TABLE withings_webhook_events IS 'Stores incoming Withings webhook notifications for processing and auditing';
COMMENT ON COLUMN withings_webhook_events.webhook_id IS 'Unique identifier from Withings for deduplication';
COMMENT ON COLUMN withings_webhook_events.application IS 'Withings application ID: 1=weight, 4=circulatory, 16=activity, 44=sleep, 46=device';
COMMENT ON COLUMN withings_webhook_events.raw_payload IS 'Complete webhook payload from Withings for debugging';

COMMENT ON TABLE withings_notification_preferences IS 'User preferences for health data notifications';
COMMENT ON TABLE user_notification_tokens IS 'Push notification tokens for different platforms';
COMMENT ON TABLE withings_webhook_subscriptions IS 'Tracks active webhook subscriptions with Withings API';