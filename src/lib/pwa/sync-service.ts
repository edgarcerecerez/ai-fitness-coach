import { createClient } from '@/utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface MealLogData {
  meal_name?: string;
  notes?: string;
  user_id: string;
  meal_date: string;
  meal_type: string;
  confidence_score: number;
  [key: string]: unknown;
}

interface PhotoUploadData {
  fileName: string;
  base64?: string;
  blob?: Blob;
  mimeType: string;
  user_id: string;
}

interface UserActionData {
  action: string;
  payload: Readonly<Record<string, unknown>>;
  user_id: string;
}

interface PendingChange {
  readonly id: string;
  readonly type: string;
  readonly data: unknown;
  readonly timestamp: number;
  readonly synced: boolean;
}

export class SyncService {
  private supabase: ReturnType<typeof createClient> | null = null;
  private realtimeChannel?: RealtimeChannel;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private syncInProgress: boolean = false;
  private pendingChanges: PendingChange[] = [];
  private onVisibilityChange = () => this.syncPendingChanges();
  private onOnline = () => this.syncPendingChanges();
  
  async init() {
    // Initialize Supabase client
    this.supabase = createClient();

    try {
      // Load pending changes from localStorage
      await this.loadPendingChanges();
    } catch (error) {
      console.error('Failed to load pending changes during init:', error);
    }

    // Set up real-time subscription for nutrition logs
    this.realtimeChannel = this.supabase
      .channel('nutrition_logs_sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nutrition_logs',
        },
        (_payload) => {
          // Trigger sync if we have pending changes
          if (this.pendingChanges.length > 0) {
            this.syncPendingChanges().catch((error) => {
              console.error('Failed to sync pending changes from realtime:', error);
            });
          }
        }
      )
      .subscribe();

    // Sync on page visibility change (user returns to app)
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    // Sync on network reconnection
    window.addEventListener('online', this.onOnline);

    // Initial sync
    try {
      await this.syncPendingChanges();
    } catch (error) {
      console.error('Failed to perform initial sync:', error);
    }
  }

  destroy() {
    if (this.realtimeChannel && this.supabase) {
      this.supabase.removeChannel(this.realtimeChannel);
    }

    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('online', this.onOnline);
  }

  private async loadPendingChanges() {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('pending_changes');
      if (stored) {
        this.pendingChanges = JSON.parse(stored);
      }
    } catch (error: unknown) {
      console.error('Failed to load pending changes:', error);
    }
  }

  private async savePendingChanges() {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('pending_changes', JSON.stringify(this.pendingChanges));
    } catch (error: unknown) {
      console.error('Failed to save pending changes:', error);
    }
  }
  
  async addPendingChange(change: { type: string; data: unknown }): Promise<void> {
    const pendingChange: PendingChange = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      synced: false,
      type: change.type,
      data: change.data,
    };

    this.pendingChanges.push(pendingChange);
    await this.savePendingChanges();

    // Trigger immediate sync attempt
    this.syncPendingChanges().catch((error) => {
      console.error('Failed to sync pending changes after adding new change:', error);
    });
  }

  async syncPendingChanges() {
    if (this.syncInProgress || !navigator.onLine || !this.supabase) {
      return;
    }

    this.syncInProgress = true;

    try {
      const unsynced = this.pendingChanges.filter((c) => !c.synced);

      for (const change of unsynced) {
        try {
          if (change.type === 'meal_log') {
            await this.supabase.from('nutrition_logs').insert(change.data);
          } else if (change.type === 'photo_upload') {
            await this.syncPhotoUpload(this.supabase, change.data);
          } else if (change.type === 'user_action') {
            await this.syncUserAction(this.supabase, change.data);
          }

          // Mark as synced by creating new object
          const syncedChange = { ...change, synced: true };
          this.pendingChanges = this.pendingChanges.map(c =>
            c.id === change.id ? syncedChange : c
          );
        } catch (error: unknown) {
          console.error('Failed to sync change:', { changeId: change.id, type: change.type }, error);
          // Keep in pending queue for retry
        }
      }

      // Remove synced changes
      this.pendingChanges = this.pendingChanges.filter((c) => !c.synced);
      await this.savePendingChanges();
    } finally {
      this.syncInProgress = false;
    }
  }
  
  private async syncPhotoUpload(supabase: SupabaseClient, data: PhotoUploadData): Promise<string> {
    // Convert base64 to blob if needed
    const blob = data.blob || (data.base64 ? this.base64ToBlob(data.base64, data.mimeType) : new Blob());

    const fileName = `${data.user_id}/${Date.now()}_${data.fileName}`;
    const { error } = await supabase.storage
      .from('meal-images')
      .upload(fileName, blob, {
        contentType: data.mimeType,
        upsert: false
      });

    if (error) {
      throw new Error(`Failed to sync photo: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }

    // Generate and return signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('meal-images')
      .createSignedUrl(fileName, 86400); // 24 hours expiry

    if (signedUrlError) {
      throw new Error(`Failed to create signed URL: ${signedUrlError.message}`);
    }

    return signedUrlData.signedUrl;
  }

  private async syncUserAction(supabase: SupabaseClient, data: UserActionData): Promise<void> {
    // Handle various user actions like profile updates, settings changes, etc.
    switch (data.action) {
      case 'update_profile':
        await supabase
          .from('user_profiles')
          .update(data.payload)
          .eq('user_id', data.user_id);
        break;

      case 'update_preferences':
        await supabase
          .from('user_profiles')
          .update({ preferences: data.payload })
          .eq('user_id', data.user_id);
        break;

      default:
        console.warn(`Unknown user action: ${data.action}`);
    }
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  async queueMealLog(mealData: MealLogData): Promise<void> {
    await this.addPendingChange({
      type: 'meal_log',
      data: mealData
    });
  }

  async queuePhotoUpload(photoData: PhotoUploadData): Promise<string | null> {
    // If online, upload immediately and return signed URL
    if (this.isOnline) {
      try {
        return await this.syncPhotoUpload(this.supabase, photoData);
      } catch (error) {
        console.error('Failed to upload photo immediately:', error);
        // Fall through to queue for later
      }
    }

    // If offline or immediate upload failed, queue for later
    await this.addPendingChange({
      type: 'photo_upload',
      data: photoData
    });

    return null; // No URL available for offline queuing
  }

  async queueUserAction(action: string, payload: Record<string, unknown>, userId: string): Promise<void> {
    await this.addPendingChange({
      type: 'user_action',
      data: { action, payload, user_id: userId }
    });
  }
}

// Singleton instance - only create in browser environment
let syncServiceInstance: SyncService | null = null;

// Factory function for safe access to the sync service instance
export function getSyncService(): SyncService {
  if (typeof window === 'undefined') {
    throw new Error('SyncService is only available in browser environment');
  }
  if (!syncServiceInstance) {
    syncServiceInstance = new SyncService();
  }
  return syncServiceInstance;
}

// Legacy export for backward compatibility
export function syncService(): SyncService {
  return getSyncService();
}