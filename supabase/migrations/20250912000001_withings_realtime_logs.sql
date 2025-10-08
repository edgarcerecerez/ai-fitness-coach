-- Enable real-time for withings_sync_logs table
ALTER PUBLICATION supabase_realtime ADD TABLE withings_sync_logs;

-- Create withings_sync_logs table for real-time status tracking
CREATE TABLE IF NOT EXISTS withings_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('weight', 'activity', 'sleep')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'error')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  records_synced INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_withings_sync_logs_user_id ON withings_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_withings_sync_logs_started_at ON withings_sync_logs(started_at DESC);

-- RLS policies
ALTER TABLE withings_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync logs"
  ON withings_sync_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert sync logs"
  ON withings_sync_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update sync logs"
  ON withings_sync_logs FOR UPDATE
  USING (true);
