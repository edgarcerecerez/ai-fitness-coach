import { WithingsDevice, WithingsConnection } from './types';
import { WithingsApiClient } from './client';
import { createClient } from '@/utils/supabase/server';

export class WithingsDeviceManager {
  private apiClient: WithingsApiClient;

  constructor() {
    this.apiClient = new WithingsApiClient();
  }

  /**
   * Update device list for user
   */
  async updateDevicesForUser(userId: string): Promise<WithingsDevice[]> {
    try {
      // Get user connection
      const connection = await this.getUserConnection(userId);
      if (!connection) {
        throw new Error('No active Withings connection found for user');
      }

      // Fetch devices from Withings API
      const response = await this.apiClient.makeRequest(userId, '/v2/user', {
        action: 'getdevice'
      });

      const devices = this.parseDevicesResponse(response);
      
      // Update database
      await this.updateDevicesInDatabase(connection.id, devices);
      
      return devices;
    } catch (error) {
      console.error(`Failed to update devices for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Parse devices from Withings API response
   */
  private parseDevicesResponse(response: any): WithingsDevice[] {
    if (!response.body || !response.body.devices) {
      return [];
    }

    return response.body.devices.map((device: any) => ({
      id: device.deviceid,
      type: this.getDeviceType(device.type),
      model: device.model,
      modelId: device.model_id,
      batteryLevel: device.battery,
      timezone: device.timezone,
      lastSessionDate: device.last_session_date ? new Date(device.last_session_date * 1000) : undefined,
      features: this.getDeviceFeatures(device.type, device.model_id),
      lastSeenAt: new Date(),
      notificationEnabled: true
    }));
  }

  /**
   * Update devices in database
   */
  private async updateDevicesInDatabase(connectionId: string, devices: WithingsDevice[]): Promise<void> {
    const supabase = createClient();
    
    // Update or insert devices
    for (const device of devices) {
      await supabase
        .from('withings_devices')
        .upsert({
          connection_id: connectionId,
          device_id: device.id,
          device_model: device.model,
          device_type: device.type,
          model_id: device.modelId,
          battery_level: device.batteryLevel,
          timezone: device.timezone,
          last_session_date: device.lastSessionDate?.toISOString(),
          features: device.features,
          last_seen_at: new Date().toISOString(),
          is_active: true
        }, {
          onConflict: 'connection_id,device_id'
        });
    }

    // Mark devices not in the response as inactive
    const deviceIds = devices.map(d => d.id);
    if (deviceIds.length > 0) {
      await supabase
        .from('withings_devices')
        .update({ is_active: false })
        .eq('connection_id', connectionId)
        .not('device_id', 'in', `(${deviceIds.map(id => `'${id}'`).join(',')})`);
    }
  }

  /**
   * Get device type from Withings type code
   */
  private getDeviceType(typeCode: number): string {
    switch (typeCode) {
      case 1: return 'scale';
      case 4: return 'blood_pressure';
      case 16: return 'activity_tracker';
      case 32: return 'sleep_monitor';
      case 64: return 'thermometer';
      default: return 'unknown';
    }
  }

  /**
   * Get device features based on type and model
   */
  private getDeviceFeatures(typeCode: number, modelId?: number): string[] {
    const features: string[] = [];

    if (typeCode === 1) { // Scale
      features.push('weight');
      
      // Advanced scales with body composition
      if (modelId && [21, 32, 61, 93].includes(modelId)) {
        features.push('body_composition', 'muscle_mass', 'bone_mass', 'water_percentage');
      }
      
      // Heart rate capable scales
      if (modelId && [32, 61, 93].includes(modelId)) {
        features.push('heart_rate');
      }
    } else if (typeCode === 4) { // Blood pressure monitor
      features.push('blood_pressure', 'heart_rate');
    } else if (typeCode === 16) { // Activity tracker
      features.push('steps', 'distance', 'calories', 'activity');
    } else if (typeCode === 32) { // Sleep monitor
      features.push('sleep_duration', 'sleep_stages', 'heart_rate');
    } else if (typeCode === 64) { // Thermometer
      features.push('temperature');
    }

    return features;
  }

  /**
   * Get devices for user
   */
  async getDevicesForUser(userId: string): Promise<WithingsDevice[]> {
    const supabase = createClient();
    
    const { data: devices, error } = await supabase
      .from('withings_devices')
      .select(`
        *,
        connection:withings_connections!inner(user_id)
      `)
      .eq('connection.user_id', userId)
      .eq('is_active', true)
      .order('last_seen_at', { ascending: false });

    if (error) {
      console.error('Failed to get devices:', error);
      return [];
    }

    return (devices || []).map(device => ({
      id: device.device_id,
      type: device.device_type,
      model: device.device_model,
      modelId: device.model_id,
      batteryLevel: device.battery_level,
      timezone: device.timezone,
      lastSessionDate: device.last_session_date ? new Date(device.last_session_date) : undefined,
      features: device.features || [],
      lastSeenAt: new Date(device.last_seen_at),
      notificationEnabled: device.notification_enabled ?? true
    }));
  }

  /**
   * Toggle device notifications
   */
  async toggleDeviceNotifications(userId: string, deviceId: string, enabled: boolean): Promise<void> {
    const supabase = createClient();
    
    // First verify the device belongs to the user
    const { data: device } = await supabase
      .from('withings_devices')
      .select(`
        id,
        connection:withings_connections!inner(user_id)
      `)
      .eq('device_id', deviceId)
      .eq('connection.user_id', userId)
      .single();

    if (!device) {
      throw new Error('Device not found or does not belong to user');
    }

    // Update notification setting
    const { error } = await supabase
      .from('withings_devices')
      .update({ notification_enabled: enabled })
      .eq('device_id', deviceId);

    if (error) {
      throw new Error(`Failed to update device notifications: ${error.message}`);
    }
  }

  /**
   * Get user connection
   */
  private async getUserConnection(userId: string): Promise<WithingsConnection | null> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('withings_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error getting user connection:', error);
      return null;
    }

    return data;
  }

  /**
   * Get active connections (for scheduled device updates)
   */
  async getActiveConnections(): Promise<{ user_id: string; id: string }[]> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('withings_connections')
      .select('user_id, id')
      .eq('is_active', true);

    if (error) {
      console.error('Error getting active connections:', error);
      return [];
    }

    return data || [];
  }
}
