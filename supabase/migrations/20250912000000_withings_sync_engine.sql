-- Withings Data Synchronization Engine - Phase 7.2
-- Creates tables for sync jobs, conflict resolution, and measurement tracking

-- Sync job tracking (enhanced for Inngest integration)
CREATE TABLE withings_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES withings_connections(id) ON DELETE CASCADE,
  inngest_event_id VARCHAR, -- Inngest event ID for tracking
  job_type VARCHAR NOT NULL, -- 'manual', 'webhook', 'scheduled', 'historical'
  status VARCHAR NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  measurements_requested INTEGER DEFAULT 0,
  measurements_processed INTEGER DEFAULT 0,
  measurements_synced INTEGER DEFAULT 0,
  measurements_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  error_code VARCHAR,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3, -- Inngest handles retries, this is for tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for sync job queries
CREATE INDEX idx_withings_sync_jobs_connection_id ON withings_sync_jobs(connection_id);
CREATE INDEX idx_withings_sync_jobs_status ON withings_sync_jobs(status);
CREATE INDEX idx_withings_sync_jobs_created_at ON withings_sync_jobs(created_at);
CREATE INDEX idx_withings_sync_jobs_inngest_event ON withings_sync_jobs(inngest_event_id);

-- Sync job details for debugging
CREATE TABLE withings_sync_job_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id UUID NOT NULL REFERENCES withings_sync_jobs(id) ON DELETE CASCADE,
  measurement_id VARCHAR NOT NULL,
  measurement_type INTEGER NOT NULL,
  measurement_value DECIMAL NOT NULL,
  measurement_unit INTEGER NOT NULL,
  measurement_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  processing_status VARCHAR NOT NULL, -- 'processed', 'skipped', 'error'
  processing_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sync_job_details_sync_job_id ON withings_sync_job_details(sync_job_id);

-- Enhance weight_logs table for Withings integration
ALTER TABLE weight_logs ADD COLUMN IF NOT EXISTS withings_measurement_id BIGINT;
ALTER TABLE weight_logs ADD COLUMN IF NOT EXISTS withings_device_id VARCHAR;
ALTER TABLE weight_logs ADD COLUMN IF NOT EXISTS sync_status VARCHAR DEFAULT 'manual'; -- 'manual', 'synced', 'pending', 'conflict'
ALTER TABLE weight_logs ADD COLUMN IF NOT EXISTS measurement_quality INTEGER; -- Quality score from Withings
ALTER TABLE weight_logs ADD COLUMN IF NOT EXISTS body_fat_percentage DECIMAL(5,2);
ALTER TABLE weight_logs ADD COLUMN IF NOT EXISTS muscle_mass_kg DECIMAL(5,2);
ALTER TABLE weight_logs ADD COLUMN IF NOT EXISTS bone_mass_kg DECIMAL(5,2);
ALTER TABLE weight_logs ADD COLUMN IF NOT EXISTS water_percentage DECIMAL(5,2);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_weight_logs_withings_measurement ON weight_logs(withings_measurement_id);
CREATE INDEX IF NOT EXISTS idx_weight_logs_sync_status ON weight_logs(sync_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_weight_logs_withings_unique ON weight_logs(user_id, withings_measurement_id) WHERE withings_measurement_id IS NOT NULL;

-- Conflict resolution tracking
CREATE TABLE withings_data_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  sync_job_id UUID REFERENCES withings_sync_jobs(id) ON DELETE SET NULL,
  conflict_type VARCHAR NOT NULL, -- 'duplicate_measurement', 'value_mismatch', 'timestamp_overlap'
  withings_measurement_id BIGINT NOT NULL,
  existing_weight_log_id UUID REFERENCES weight_logs(id) ON DELETE CASCADE,
  withings_data JSONB NOT NULL,
  existing_data JSONB NOT NULL,
  resolution_strategy VARCHAR, -- 'keep_existing', 'use_withings', 'manual_review', 'merge'
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by VARCHAR, -- 'system', 'user'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_withings_conflicts_user_id ON withings_data_conflicts(user_id);
CREATE INDEX idx_withings_conflicts_resolved ON withings_data_conflicts(resolved_at);

-- Device tracking
CREATE TABLE withings_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES withings_connections(id) ON DELETE CASCADE,
  device_id VARCHAR NOT NULL,
  device_model VARCHAR,
  device_type VARCHAR, -- 'scale', 'blood_pressure', 'thermometer'
  battery_level INTEGER,
  timezone VARCHAR,
  last_session_date TIMESTAMP WITH TIME ZONE,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(connection_id, device_id)
);

CREATE INDEX idx_withings_devices_connection_id ON withings_devices(connection_id);

-- Row Level Security for new tables
ALTER TABLE withings_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own sync jobs" 
ON withings_sync_jobs 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM withings_connections wc
    JOIN user_profiles up ON up.id = wc.user_id
    WHERE wc.id = withings_sync_jobs.connection_id 
    AND up.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM withings_connections wc
    JOIN user_profiles up ON up.id = wc.user_id
    WHERE wc.id = withings_sync_jobs.connection_id 
    AND up.user_id = auth.uid()
  )
);

ALTER TABLE withings_sync_job_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own sync job details" 
ON withings_sync_job_details 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM withings_sync_jobs wsj
    JOIN withings_connections wc ON wc.id = wsj.connection_id
    JOIN user_profiles up ON up.id = wc.user_id
    WHERE wsj.id = withings_sync_job_details.sync_job_id 
    AND up.user_id = auth.uid()
  )
);

ALTER TABLE withings_data_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own data conflicts" 
ON withings_data_conflicts 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = withings_data_conflicts.user_id 
    AND user_profiles.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = withings_data_conflicts.user_id 
    AND user_profiles.user_id = auth.uid()
  )
);

ALTER TABLE withings_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own devices" 
ON withings_devices 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM withings_connections wc
    JOIN user_profiles up ON up.id = wc.user_id
    WHERE wc.id = withings_devices.connection_id 
    AND up.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM withings_connections wc
    JOIN user_profiles up ON up.id = wc.user_id
    WHERE wc.id = withings_devices.connection_id 
    AND up.user_id = auth.uid()
  )
);

-- Add updated_at trigger for sync jobs
CREATE TRIGGER update_withings_sync_jobs_updated_at 
    BEFORE UPDATE ON withings_sync_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();