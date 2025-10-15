# Phase 7: Withings Smart Scale Integration - Product Requirements Document

## Overview

This phase focuses on integrating Withings smart scale devices to provide automated, accurate weight tracking and body composition data collection. This integration eliminates manual data entry, improves data accuracy, and enhances user engagement through seamless device connectivity.

## Business Objectives

### Primary Goals
- **Automated Data Collection**: Replace manual weight logging with automatic syncing from Withings devices
- **Enhanced Data Accuracy**: Eliminate human error in weight measurements and gain access to advanced metrics
- **Improved User Engagement**: Reduce friction in data entry to increase consistent tracking
- **Professional-Grade Metrics**: Access to body composition data (body fat %, muscle mass, bone mass, water %)

### Success Metrics
- 80%+ reduction in manual weight entries for connected users
- 50%+ increase in weight logging frequency for connected users
- 95%+ data sync reliability rate
- Support for 10+ Withings device models

## Technical Architecture

### API Integration Overview
- **Provider**: Withings Health Mate Platform
- **Protocol**: OAuth 2.0 authentication with RESTful API
- **Data Format**: JSON over HTTPS
- **Rate Limits**: 120 requests per minute per user
- **Compliance**: HIPAA/HDS compliant data handling

### Core Components

#### 1. Authentication Service (`WithingsAuthService`)
```typescript
interface WithingsAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: WithingsScope[];
}

interface WithingsTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  userId: string;
}
```

#### 2. Data Sync Service (`WithingsDataService`)
```typescript
interface WithingsMeasurement {
  measureType: WithingsMeasureType;
  value: number;
  unit: WithingsUnit;
  timestamp: Date;
  deviceId?: string;
}

enum WithingsMeasureType {
  WEIGHT = 1,
  HEIGHT = 4,
  FAT_FREE_MASS = 5,
  FAT_RATIO = 6,
  FAT_MASS_WEIGHT = 8,
  DIASTOLIC_BLOOD_PRESSURE = 9,
  SYSTOLIC_BLOOD_PRESSURE = 10,
  HEART_PULSE = 11,
  TEMPERATURE = 12,
  SPO2 = 54,
  BODY_TEMPERATURE = 71,
  SKIN_TEMPERATURE = 72,
  MUSCLE_MASS = 76,
  HYDRATION = 77,
  BONE_MASS = 88,
  PULSE_WAVE_VELOCITY = 91
}
```

#### 3. Webhook Handler (`WithingsWebhookService`)
```typescript
interface WithingsNotification {
  userid: string;
  appli: WithingsApplication;
  startdate: number;
  enddate: number;
  date: number;
}

enum WithingsApplication {
  WEIGHT = 1,
  CIRCULATORY = 4,
  ACTIVITY = 16,
  SLEEP = 44
}
```

### Database Schema Extensions

#### New Tables
```sql
-- Withings integration tracking
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
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id),
  UNIQUE(withings_user_id)
);

-- Withings device registry
CREATE TABLE withings_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES withings_connections(id) ON DELETE CASCADE,
  device_id VARCHAR NOT NULL,
  device_model VARCHAR NOT NULL,
  device_type VARCHAR NOT NULL,
  timezone VARCHAR,
  last_session_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(connection_id, device_id)
);

-- Sync job tracking
CREATE TABLE withings_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES withings_connections(id) ON DELETE CASCADE,
  job_type VARCHAR NOT NULL, -- 'manual', 'webhook', 'scheduled'
  status VARCHAR NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  measurements_synced INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Table Modifications
```sql
-- Add Withings tracking to weight_logs
ALTER TABLE weight_logs ADD COLUMN withings_measurement_id VARCHAR;
ALTER TABLE weight_logs ADD COLUMN withings_device_id VARCHAR;
ALTER TABLE weight_logs ADD COLUMN sync_status VARCHAR DEFAULT 'manual'; -- 'manual', 'synced', 'pending'

-- Index for efficient lookups
CREATE INDEX idx_weight_logs_withings_measurement ON weight_logs(withings_measurement_id);
CREATE INDEX idx_weight_logs_sync_status ON weight_logs(sync_status);
```

### Security Considerations

#### Token Management
- All tokens encrypted at rest using AES-256
- Refresh token rotation on every use
- Automatic token cleanup on disconnection
- Rate limiting per user and global API calls

#### Data Privacy
- Minimal data storage principle - only store what's necessary
- User consent tracking for data collection types
- Ability to delete all synced data on user request
- Audit logging for all data access

## API Endpoints

### Authentication Flow
```typescript
// 1. Initiate OAuth flow
POST /api/integrations/withings/auth/initiate
Response: { authUrl: string, state: string }

// 2. Handle OAuth callback
GET /api/integrations/withings/auth/callback?code=...&state=...
Response: { success: boolean, connected: boolean }

// 3. Disconnect integration
DELETE /api/integrations/withings/connection
Response: { success: boolean }
```

### Data Management
```typescript
// Get connection status
GET /api/integrations/withings/status
Response: {
  connected: boolean,
  lastSync?: Date,
  deviceCount?: number,
  availableScopes: string[]
}

// Manual data sync
POST /api/integrations/withings/sync
Body: { startDate?: Date, endDate?: Date }
Response: { jobId: string, status: string }

// Get sync history
GET /api/integrations/withings/sync-history
Response: {
  jobs: SyncJob[],
  totalMeasurements: number,
  lastSync: Date
}
```

### Webhook Endpoints
```typescript
// Withings webhook receiver
POST /api/webhooks/withings
Headers: { 'X-Withings-Signature': string }
Body: WithingsNotification
Response: { received: boolean }
```

## Implementation Phases

### Phase 7.1: Foundation & Authentication (Week 1-2)
**Technical Focus**: OAuth 2.0 flow, token management, basic API client

**Deliverables**:
- Withings OAuth 2.0 integration service
- Encrypted token storage system
- Basic API client with rate limiting
- Database schema setup
- Connection UI in user settings

**Technical Details**:
- Implement PKCE (Proof Key for Code Exchange) for enhanced security
- Token refresh background job with exponential backoff
- Connection status monitoring with health checks
- Error handling for expired/revoked tokens

### Phase 7.2: Data Synchronization Engine (Week 3-4)
**Technical Focus**: Measurement data retrieval, data mapping, conflict resolution

**Deliverables**:
- Measurement data sync service
- Data transformation and validation
- Conflict resolution for overlapping manual entries
- Sync job queue system
- Historical data import functionality

**Technical Details**:
- Batch processing for large historical datasets
- Idempotent sync operations to handle retries
- Data deduplication algorithms
- Measurement timestamp handling across timezones

### Phase 7.3: Real-time Updates & Webhooks (Week 5-6)
**Technical Focus**: Webhook processing, real-time data updates, notification system

**Deliverables**:
- Webhook endpoint and signature verification
- Real-time measurement processing
- Push notification system for new measurements
- Sync failure alerts and recovery
- Device management interface

**Technical Details**:
- Webhook payload validation and replay protection
- Message queue for webhook processing
- Dead letter queue for failed webhook processing
- Device discovery and registration automation

### Phase 7.4: Advanced Features & Body Composition (Week 7-8)
**Technical Focus**: Body composition data, advanced metrics, analytics integration

**Deliverables**:
- Body composition data support (body fat %, muscle mass, etc.)
- Advanced measurement analytics
- Data export functionality
- Integration with AI recommendation engine
- Performance monitoring and alerting

**Technical Details**:
- Support for all Withings measurement types
- Measurement trend analysis algorithms
- Data quality scoring system
- Integration with existing nutrition and mood data

## User Experience Flow

### Connection Flow
1. **Discovery**: User navigates to Settings > Connected Devices
2. **Authentication**: Click "Connect Withings" → OAuth redirect → Permission grants
3. **Confirmation**: Return to app with success message and device list
4. **First Sync**: Automatic historical data import with progress indicator

### Daily Usage Flow
1. **Measurement**: User steps on Withings scale
2. **Automatic Sync**: Data syncs to Withings cloud
3. **Webhook Trigger**: Withings notifies our system
4. **Data Processing**: Measurement added to user's log
5. **Notification**: Optional push notification of new measurement

### Management Flow
1. **Status Monitoring**: Connection status visible in settings
2. **Manual Sync**: Force sync button for immediate updates
3. **Sync History**: View of recent sync jobs and status
4. **Disconnection**: Clean removal with data retention options

## Error Handling & Recovery

### Common Error Scenarios
- **Token Expiration**: Automatic refresh with fallback to manual re-auth
- **API Rate Limiting**: Exponential backoff with user notification
- **Network Failures**: Retry logic with circuit breaker pattern
- **Data Conflicts**: User-configurable conflict resolution rules
- **Device Offline**: Graceful handling with sync when device reconnects

### Monitoring & Alerting
- **Sync Success Rate**: Alert if < 95% over 24 hours
- **API Response Times**: Alert if > 5 seconds 95th percentile
- **Token Expiration**: Proactive user notification 7 days before expiry
- **Webhook Failures**: Alert on 3+ consecutive failures

## Privacy & Compliance

### Data Handling
- **Minimal Collection**: Only collect measurements user explicitly consents to
- **Data Retention**: 30-day retention for sync metadata, user-controlled for measurements
- **Export Rights**: Full data export in JSON format
- **Deletion Rights**: Complete data removal within 30 days

### Consent Management
- **Granular Permissions**: Separate consent for different measurement types
- **Consent Tracking**: Audit trail of all consent changes
- **Withdrawal Process**: Simple disconnection with clear data implications

## Success Criteria

### Technical Metrics
- **Sync Reliability**: 99%+ successful sync rate
- **Response Times**: < 2 seconds for manual sync initiation
- **Data Accuracy**: 100% measurement value accuracy
- **Uptime**: 99.9% webhook endpoint availability

### User Experience Metrics
- **Connection Success Rate**: 90%+ successful first-time connections
- **User Retention**: 80%+ of connected users remain connected after 30 days
- **Support Tickets**: < 2% of connected users report sync issues monthly
- **User Satisfaction**: 4.5+ rating on integration experience survey

## Risks & Mitigation

### Technical Risks
- **API Changes**: Monitor Withings developer communications, implement API versioning
- **Rate Limiting**: Implement intelligent queuing and user communication
- **Data Loss**: Comprehensive backup and audit trail systems
- **Security Breach**: End-to-end encryption and regular security audits

### Business Risks
- **User Privacy Concerns**: Clear privacy policy and granular controls
- **Integration Complexity**: Phased rollout with beta user group
- **Support Load**: Comprehensive documentation and automated diagnostics

## Future Enhancements

### Short-term (Next 6 months)
- Support for additional Withings devices (blood pressure monitors, thermometers)
- Advanced analytics and trend detection
- Integration with fitness tracking data
- Multi-user household support

### Long-term (6+ months)
- Integration with other smart scale manufacturers
- Predictive analytics using body composition trends
- Healthcare provider data sharing
- API for third-party integrations