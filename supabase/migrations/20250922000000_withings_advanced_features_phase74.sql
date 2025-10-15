-- Phase 7.4: Withings advanced analytics and export tables
-- This migration adds analytical, insights, export, goal tracking, and monitoring tables
-- to support advanced Withings integration features.

-- Body composition analytics
CREATE TABLE IF NOT EXISTS withings_body_composition_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  weight_log_id UUID NOT NULL REFERENCES weight_logs(id) ON DELETE CASCADE,
  analysis_date TIMESTAMP WITH TIME ZONE NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  body_fat_percentage DECIMAL(5,2),
  muscle_mass_kg DECIMAL(5,2),
  bone_mass_kg DECIMAL(5,2),
  water_percentage DECIMAL(5,2),
  bmi DECIMAL(5,2),
  body_fat_mass_kg DECIMAL(5,2),
  lean_body_mass_kg DECIMAL(5,2),
  metabolic_age INTEGER,
  visceral_fat_level INTEGER,
  healthy_weight_range_min DECIMAL(5,2),
  healthy_weight_range_max DECIMAL(5,2),
  target_body_fat_min DECIMAL(5,2),
  target_body_fat_max DECIMAL(5,2),
  measurement_quality_score INTEGER CHECK (measurement_quality_score BETWEEN 1 AND 100),
  data_completeness_score INTEGER CHECK (data_completeness_score BETWEEN 0 AND 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(weight_log_id)
);

CREATE INDEX IF NOT EXISTS idx_body_comp_analysis_user_date
  ON withings_body_composition_analysis(user_id, analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_body_comp_analysis_quality
  ON withings_body_composition_analysis(measurement_quality_score DESC);

-- Health trend analysis
CREATE TABLE IF NOT EXISTS withings_health_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  metric_type VARCHAR NOT NULL,
  trend_period VARCHAR NOT NULL,
  analysis_date TIMESTAMP WITH TIME ZONE NOT NULL,
  start_value DECIMAL(8,2) NOT NULL,
  end_value DECIMAL(8,2) NOT NULL,
  change_absolute DECIMAL(8,2) NOT NULL,
  change_percentage DECIMAL(5,2) NOT NULL,
  trend_direction VARCHAR NOT NULL CHECK (trend_direction IN ('up', 'down', 'stable')),
  trend_strength DECIMAL(3,2) NOT NULL CHECK (trend_strength BETWEEN 0 AND 1),
  data_points_count INTEGER NOT NULL,
  standard_deviation DECIMAL(8,4),
  correlation_coefficient DECIMAL(3,2),
  r_squared DECIMAL(3,2),
  health_impact VARCHAR NOT NULL CHECK (health_impact IN ('positive', 'negative', 'neutral')),
  confidence_level DECIMAL(3,2) NOT NULL CHECK (confidence_level BETWEEN 0 AND 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, metric_type, trend_period, analysis_date)
);

CREATE INDEX IF NOT EXISTS idx_health_trends_user_metric
  ON withings_health_trends(user_id, metric_type, analysis_date DESC);

-- AI-generated insights
CREATE TABLE IF NOT EXISTS withings_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  insight_type VARCHAR NOT NULL,
  category VARCHAR NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_items JSONB,
  trigger_data JSONB NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  importance_level VARCHAR NOT NULL CHECK (importance_level IN ('low', 'medium', 'high', 'critical')),
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  user_feedback INTEGER CHECK (user_feedback BETWEEN 1 AND 5),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_user_active
  ON withings_ai_insights(user_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_importance
  ON withings_ai_insights(importance_level, created_at DESC);

-- Data export tracking
CREATE TABLE IF NOT EXISTS withings_data_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  export_type VARCHAR NOT NULL,
  export_format VARCHAR NOT NULL,
  date_range_start TIMESTAMP WITH TIME ZONE,
  date_range_end TIMESTAMP WITH TIME ZONE,
  included_metrics TEXT[],
  status VARCHAR NOT NULL DEFAULT 'requested',
  file_path TEXT,
  file_size_bytes BIGINT,
  download_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  compliance_flags JSONB,
  access_log JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_data_exports_user_status
  ON withings_data_exports(user_id, status, created_at DESC);

-- Health goal tracking
CREATE TABLE IF NOT EXISTS withings_health_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  goal_type VARCHAR NOT NULL,
  metric_type VARCHAR NOT NULL,
  target_value DECIMAL(8,2) NOT NULL,
  current_value DECIMAL(8,2),
  start_value DECIMAL(8,2) NOT NULL,
  target_date DATE,
  progress_percentage DECIMAL(5,2) DEFAULT 0,
  is_on_track BOOLEAN DEFAULT TRUE,
  estimated_completion_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_health_goals_user_active
  ON withings_health_goals(user_id, is_active);

-- Performance monitoring
CREATE TABLE IF NOT EXISTS withings_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR NOT NULL,
  metric_value DECIMAL(10,4) NOT NULL,
  metric_unit VARCHAR,
  tags JSONB,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_name_time
  ON withings_performance_metrics(metric_name, recorded_at DESC);

-- Enable RLS policies consistent with existing patterns
ALTER TABLE withings_body_composition_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE withings_health_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE withings_ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE withings_data_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE withings_health_goals ENABLE ROW LEVEL SECURITY;

-- Body composition policies
CREATE POLICY IF NOT EXISTS withings_body_comp_select ON withings_body_composition_analysis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_body_composition_analysis.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS withings_body_comp_insert ON withings_body_composition_analysis
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_body_composition_analysis.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS withings_body_comp_update ON withings_body_composition_analysis
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_body_composition_analysis.user_id
        AND user_profiles.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_body_composition_analysis.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS withings_body_comp_delete ON withings_body_composition_analysis
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_body_composition_analysis.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

-- Health trends policies
CREATE POLICY IF NOT EXISTS withings_health_trends_select ON withings_health_trends
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_health_trends.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS withings_health_trends_insert ON withings_health_trends
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_health_trends.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS withings_health_trends_update ON withings_health_trends
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_health_trends.user_id
        AND user_profiles.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_health_trends.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS withings_health_trends_delete ON withings_health_trends
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_health_trends.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

-- AI insights policies
CREATE POLICY IF NOT EXISTS withings_ai_insights_select ON withings_ai_insights
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_ai_insights.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS withings_ai_insights_insert ON withings_ai_insights
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_ai_insights.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS withings_ai_insights_update ON withings_ai_insights
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_ai_insights.user_id
        AND user_profiles.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_ai_insights.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS withings_ai_insights_delete ON withings_ai_insights
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_ai_insights.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

-- Data export policies
CREATE POLICY IF NOT EXISTS withings_data_exports_select ON withings_data_exports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_data_exports.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS withings_data_exports_insert ON withings_data_exports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_data_exports.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS withings_data_exports_update ON withings_data_exports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_data_exports.user_id
        AND user_profiles.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_data_exports.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS withings_data_exports_delete ON withings_data_exports
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_data_exports.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

-- Health goals policies
CREATE POLICY IF NOT EXISTS withings_health_goals_select ON withings_health_goals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_health_goals.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS withings_health_goals_insert ON withings_health_goals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_health_goals.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS withings_health_goals_update ON withings_health_goals
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_health_goals.user_id
        AND user_profiles.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_health_goals.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS withings_health_goals_delete ON withings_health_goals
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = withings_health_goals.user_id
        AND user_profiles.user_id = auth.uid()
    )
  );
