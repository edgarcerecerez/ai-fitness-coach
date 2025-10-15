-- Withings Integration Foundation - Phase 7.1
-- Creates tables for OAuth connections, token management, and audit logging

-- Withings integration connections
CREATE TABLE withings_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  withings_user_id VARCHAR NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scopes TEXT[] NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_token_refresh_at TIMESTAMP WITH TIME ZONE,
  refresh_failure_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id),
  UNIQUE(withings_user_id)
);

-- Create indexes for performance
CREATE INDEX idx_withings_connections_user_id ON withings_connections(user_id);
CREATE INDEX idx_withings_connections_active ON withings_connections(is_active);
CREATE INDEX idx_withings_connections_token_expires ON withings_connections(token_expires_at);

-- Row Level Security
ALTER TABLE withings_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own withings connections" 
ON withings_connections 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = withings_connections.user_id 
    AND user_profiles.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = withings_connections.user_id 
    AND user_profiles.user_id = auth.uid()
  )
);

-- Connection audit log
CREATE TABLE withings_connection_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES withings_connections(id) ON DELETE CASCADE,
  event_type VARCHAR NOT NULL, -- 'connected', 'disconnected', 'token_refreshed', 'token_expired', 'error'
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_withings_connection_events_connection_id ON withings_connection_events(connection_id);
CREATE INDEX idx_withings_connection_events_created_at ON withings_connection_events(created_at);

-- OAuth state tracking table
CREATE TABLE withings_auth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state VARCHAR NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  code_verifier VARCHAR NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_withings_auth_states_state ON withings_auth_states(state);
CREATE INDEX idx_withings_auth_states_expires ON withings_auth_states(expires_at);
CREATE INDEX idx_withings_auth_states_user_id ON withings_auth_states(user_id);

-- RLS for auth states
ALTER TABLE withings_auth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own auth states" 
ON withings_auth_states 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = withings_auth_states.user_id 
    AND user_profiles.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = withings_auth_states.user_id 
    AND user_profiles.user_id = auth.uid()
  )
);

-- Add updated_at trigger for withings_connections
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_withings_connections_updated_at 
    BEFORE UPDATE ON withings_connections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();