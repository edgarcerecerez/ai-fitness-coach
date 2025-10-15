import { SyncService } from '../sync-service';
import { createClient } from '@/utils/supabase/client';

jest.mock('@/utils/supabase/client');

describe('SyncService with Real-time', () => {
  let syncService: SyncService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      channel: jest.fn().mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
      }),
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      removeChannel: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    syncService = new SyncService();
  });

  afterEach(() => {
    syncService.destroy();
  });

  it('initializes with real-time subscription', async () => {
    await syncService.init();

    expect(mockSupabase.channel).toHaveBeenCalledWith('nutrition_logs_sync');
  });

  it('adds pending change and attempts sync', async () => {
    await syncService.init();

    await syncService.addPendingChange({
      type: 'meal_log',
      data: { food_items: 'Test meal' },
    });

    // Should call insert
    expect(mockSupabase.from).toHaveBeenCalledWith('nutrition_logs');
  });

  it('syncs on visibility change', async () => {
    await syncService.init();

    const syncSpy = jest.spyOn(syncService, 'syncPendingChanges');

    // Simulate tab becoming visible
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
    });

    document.dispatchEvent(new Event('visibilitychange'));

    expect(syncSpy).toHaveBeenCalled();
  });

  it('syncs on network reconnection', async () => {
    await syncService.init();

    const syncSpy = jest.spyOn(syncService, 'syncPendingChanges');

    window.dispatchEvent(new Event('online'));

    expect(syncSpy).toHaveBeenCalled();
  });
}); 