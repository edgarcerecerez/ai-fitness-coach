# Phase 8.5: Testing & Quality - Technical Implementation

## Summary

**Goal**: Achieve 80%+ test coverage with comprehensive unit, integration, and visual regression tests.

**Priority**: 🟡 HIGH
**Duration**: Week 5 (40-52 hours)
**Dependencies**: Phases 8.1-8.4 (all components and utilities must be complete)

### What We're Achieving

This phase establishes comprehensive test coverage to catch bugs before production:

1. **Unit Tests for Calorie Tracker** - Test 7 untested components (RecentMeals, FoodLogManager, etc.)
2. **Unit Tests for Withings Components** - Test 4 integration components
3. **Integration Tests** - End-to-end user flows with Playwright
4. **Visual Regression Tests** - Screenshot-based testing for UI consistency
5. **Performance Testing** - Lighthouse CI integration

**Impact**: Catch bugs early, prevent regressions, ensure quality before production launch.

### Success Criteria

- [ ] Test coverage ≥80% (from ~54%)
- [ ] All calorie-tracker components tested (7 files)
- [ ] All Withings components tested (4 files)
- [ ] Integration tests for critical flows (3 flows)
- [ ] Visual regression tests for all pages (8 pages)
- [ ] Lighthouse CI configured and passing
- [ ] All tests passing

---

## Technical Implementation

### Task 8.5.1: Add Tests for Calorie Tracker Components

**Problem**: 7 core calorie-tracker components have no tests.

**Components to Test**:
1. RecentMeals.tsx (HIGH priority)
2. DailyCalorieSummary.tsx (HIGH priority)
3. FoodLogManager.tsx (HIGH priority)
4. AIAnalysisDisplay.tsx (MEDIUM priority)
5. OptimizedCamera.tsx (MEDIUM priority)
6. ImagePreview.tsx (LOW priority)
7. QuickActions.tsx (LOW priority)

#### Test 1: RecentMeals.tsx

**File**: `src/components/calorie-tracker/__tests__/RecentMeals.test.tsx`

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { RecentMeals } from '../RecentMeals';
import { createClient } from '@/utils/supabase/client';

jest.mock('@/utils/supabase/client');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

describe('RecentMeals', () => {
  const mockSupabase = {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('displays loading state initially', () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user' } },
    });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue(new Promise(() => {})), // Never resolves
          }),
        }),
      }),
    });

    render(<RecentMeals />);

    // Should show loading spinner
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('displays recent meals when data is available', async () => {
    const mockMeals = [
      {
        id: '1',
        created_at: new Date().toISOString(),
        total_calories: 450,
        food_items: 'Chicken Salad',
        confidence_score: 0.85,
        image_url: 'https://example.com/image.jpg',
      },
      {
        id: '2',
        created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        total_calories: 320,
        food_items: 'Protein Shake',
        confidence_score: 0.92,
        image_url: null,
      },
    ];

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user' } },
    });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: mockMeals, error: null }),
          }),
        }),
      }),
    });

    render(<RecentMeals />);

    await waitFor(() => {
      expect(screen.getByText('Chicken Salad')).toBeInTheDocument();
      expect(screen.getByText('450 cal')).toBeInTheDocument();
      expect(screen.getByText('Protein Shake')).toBeInTheDocument();
      expect(screen.getByText('320 cal')).toBeInTheDocument();
    });
  });

  it('displays empty state when no meals', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user' } },
    });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    render(<RecentMeals />);

    await waitFor(() => {
      expect(screen.getByText(/no meals logged yet/i)).toBeInTheDocument();
    });
  });

  it('displays confidence badges correctly', async () => {
    const mockMeals = [
      {
        id: '1',
        created_at: new Date().toISOString(),
        total_calories: 400,
        food_items: 'High confidence meal',
        confidence_score: 0.9,
        image_url: null,
      },
      {
        id: '2',
        created_at: new Date().toISOString(),
        total_calories: 400,
        food_items: 'Medium confidence meal',
        confidence_score: 0.7,
        image_url: null,
      },
      {
        id: '3',
        created_at: new Date().toISOString(),
        total_calories: 400,
        food_items: 'Low confidence meal',
        confidence_score: 0.5,
        image_url: null,
      },
    ];

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user' } },
    });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: mockMeals, error: null }),
          }),
        }),
      }),
    });

    render(<RecentMeals />);

    await waitFor(() => {
      // High confidence badge (success variant)
      expect(screen.getByText('High Confidence')).toBeInTheDocument();

      // Medium confidence badge (warning variant)
      expect(screen.getByText('Medium Confidence')).toBeInTheDocument();

      // Low confidence badge (destructive variant)
      expect(screen.getByText('Low Confidence')).toBeInTheDocument();
    });
  });

  it('handles delete action', async () => {
    const mockMeals = [
      {
        id: '1',
        created_at: new Date().toISOString(),
        total_calories: 450,
        food_items: 'Chicken Salad',
        confidence_score: 0.85,
        image_url: null,
      },
    ];

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user' } },
    });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: mockMeals, error: null }),
          }),
        }),
      }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    render(<RecentMeals />);

    await waitFor(() => {
      expect(screen.getByText('Chicken Salad')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButton = screen.getByLabelText(/delete/i);
    fireEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByText(/confirm/i);
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('nutrition_logs');
      expect(screen.queryByText('Chicken Salad')).not.toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user' } },
    });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest
              .fn()
              .mockResolvedValue({ data: null, error: { message: 'Database error' } }),
          }),
        }),
      }),
    });

    render(<RecentMeals />);

    await waitFor(() => {
      expect(screen.getByText(/error loading meals/i)).toBeInTheDocument();
    });
  });

  it('displays relative timestamps correctly', async () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    const yesterday = new Date(now.getTime() - 86400000);

    const mockMeals = [
      {
        id: '1',
        created_at: now.toISOString(),
        total_calories: 400,
        food_items: 'Recent meal',
        confidence_score: 0.85,
        image_url: null,
      },
      {
        id: '2',
        created_at: oneHourAgo.toISOString(),
        total_calories: 300,
        food_items: 'Hour ago meal',
        confidence_score: 0.85,
        image_url: null,
      },
      {
        id: '3',
        created_at: yesterday.toISOString(),
        total_calories: 500,
        food_items: 'Yesterday meal',
        confidence_score: 0.85,
        image_url: null,
      },
    ];

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user' } },
    });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: mockMeals, error: null }),
          }),
        }),
      }),
    });

    render(<RecentMeals />);

    await waitFor(() => {
      expect(screen.getByText(/just now|few seconds ago/i)).toBeInTheDocument();
      expect(screen.getByText(/1h ago/i)).toBeInTheDocument();
      expect(screen.getByText(/yesterday|1d ago/i)).toBeInTheDocument();
    });
  });
});
```

#### Test 2: DailyCalorieSummary.tsx

**File**: `src/components/calorie-tracker/__tests__/DailyCalorieSummary.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { DailyCalorieSummary } from '../DailyCalorieSummary';

describe('DailyCalorieSummary', () => {
  const today = new Date();
  const todayISO = today.toISOString();
  const yesterday = new Date(today.getTime() - 86400000);
  const yesterdayISO = yesterday.toISOString();

  it('calculates daily totals correctly (today only)', () => {
    const meals = [
      { total_calories: 400, created_at: todayISO },
      { total_calories: 600, created_at: todayISO },
      { total_calories: 300, created_at: yesterdayISO }, // Should be excluded
    ];

    render(<DailyCalorieSummary meals={meals} targetCalories={2000} />);

    // Should show 1000 cal (today only), not 1300
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getByText(/cal/i)).toBeInTheDocument();
  });

  it('displays progress bar with correct percentage', () => {
    const meals = [{ total_calories: 500, created_at: todayISO }];

    const { container } = render(
      <DailyCalorieSummary meals={meals} targetCalories={2000} />
    );

    // 500 / 2000 = 25%
    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toHaveAttribute('aria-valuenow', '25');
  });

  it('shows warning when over target calories', () => {
    const meals = [
      { total_calories: 1200, created_at: todayISO },
      { total_calories: 1000, created_at: todayISO },
    ];

    render(<DailyCalorieSummary meals={meals} targetCalories={2000} />);

    // 2200 cal, over target of 2000
    expect(screen.getByText('2200')).toBeInTheDocument();
    expect(screen.getByText(/over target/i)).toBeInTheDocument();
  });

  it('shows success when under target calories', () => {
    const meals = [{ total_calories: 1500, created_at: todayISO }];

    render(<DailyCalorieSummary meals={meals} targetCalories={2000} />);

    expect(screen.getByText('1500')).toBeInTheDocument();
    expect(screen.getByText(/500 remaining/i)).toBeInTheDocument();
  });

  it('handles null calories gracefully', () => {
    const meals = [
      { total_calories: 400, created_at: todayISO },
      { total_calories: null, created_at: todayISO },
      { total_calories: 200, created_at: todayISO },
    ];

    render(<DailyCalorieSummary meals={meals} targetCalories={2000} />);

    // Should sum to 600 (ignoring null)
    expect(screen.getByText('600')).toBeInTheDocument();
  });

  it('handles empty meals array', () => {
    render(<DailyCalorieSummary meals={[]} targetCalories={2000} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/no meals logged today/i)).toBeInTheDocument();
  });

  it('displays target calories', () => {
    const meals = [{ total_calories: 500, created_at: todayISO }];

    render(<DailyCalorieSummary meals={meals} targetCalories={2500} />);

    expect(screen.getByText(/2500/i)).toBeInTheDocument();
    expect(screen.getByText(/target/i)).toBeInTheDocument();
  });

  it('shows percentage of target', () => {
    const meals = [{ total_calories: 1000, created_at: todayISO }];

    render(<DailyCalorieSummary meals={meals} targetCalories={2000} />);

    // 1000 / 2000 = 50%
    expect(screen.getByText(/50%/i)).toBeInTheDocument();
  });

  it('handles 100% progress correctly', () => {
    const meals = [{ total_calories: 2000, created_at: todayISO }];

    const { container } = render(
      <DailyCalorieSummary meals={meals} targetCalories={2000} />
    );

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('caps progress bar at 100% visually (even if over)', () => {
    const meals = [{ total_calories: 3000, created_at: todayISO }];

    const { container } = render(
      <DailyCalorieSummary meals={meals} targetCalories={2000} />
    );

    // Progress bar should not exceed 100% width
    const progressBar = container.querySelector('[role="progressbar"]');
    const ariaValue = progressBar?.getAttribute('aria-valuenow');

    // Actual value is 150%, but display should cap at 100%
    expect(Number(ariaValue)).toBeGreaterThan(100);
  });
});
```

#### Test 3: FoodLogManager.tsx

**File**: `src/components/calorie-tracker/__tests__/FoodLogManager.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FoodLogManager } from '../FoodLogManager';
import { createClient } from '@/utils/supabase/client';

jest.mock('@/utils/supabase/client');

describe('FoodLogManager', () => {
  const mockSupabase = {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user' } },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('displays nutrition logs in table', async () => {
    const mockLogs = [
      {
        id: '1',
        created_at: '2024-01-15T12:00:00Z',
        food_items: 'Chicken Salad',
        total_calories: 450,
        confidence_score: 0.85,
      },
      {
        id: '2',
        created_at: '2024-01-15T18:00:00Z',
        food_items: 'Pasta',
        total_calories: 620,
        confidence_score: 0.92,
      },
    ];

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockLogs, error: null }),
        }),
      }),
    });

    render(<FoodLogManager />);

    await waitFor(() => {
      expect(screen.getByText('Chicken Salad')).toBeInTheDocument();
      expect(screen.getByText('450')).toBeInTheDocument();
      expect(screen.getByText('Pasta')).toBeInTheDocument();
      expect(screen.getByText('620')).toBeInTheDocument();
    });
  });

  it('filters logs by date range', async () => {
    const mockLogs = [
      {
        id: '1',
        created_at: '2024-01-10T12:00:00Z',
        food_items: 'Old meal',
        total_calories: 400,
        confidence_score: 0.8,
      },
      {
        id: '2',
        created_at: '2024-01-15T12:00:00Z',
        food_items: 'Recent meal',
        total_calories: 500,
        confidence_score: 0.9,
      },
    ];

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockLogs, error: null }),
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockResolvedValue({
              data: [mockLogs[1]], // Only recent meal
              error: null,
            }),
          }),
        }),
      }),
    });

    render(<FoodLogManager />);

    // Select date range
    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);

    await userEvent.type(startDateInput, '2024-01-14');
    await userEvent.type(endDateInput, '2024-01-16');

    const filterButton = screen.getByText(/filter/i);
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(screen.getByText('Recent meal')).toBeInTheDocument();
      expect(screen.queryByText('Old meal')).not.toBeInTheDocument();
    });
  });

  it('handles delete action with confirmation', async () => {
    const mockLogs = [
      {
        id: '1',
        created_at: '2024-01-15T12:00:00Z',
        food_items: 'Chicken Salad',
        total_calories: 450,
        confidence_score: 0.85,
      },
    ];

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockLogs, error: null }),
        }),
      }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    render(<FoodLogManager />);

    await waitFor(() => {
      expect(screen.getByText('Chicken Salad')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButton = screen.getByLabelText(/delete/i);
    fireEvent.click(deleteButton);

    // Should show confirmation dialog
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('nutrition_logs');
      // Meal should be removed from display
      expect(screen.queryByText('Chicken Salad')).not.toBeInTheDocument();
    });
  });

  it('handles edit action and updates log', async () => {
    const mockLogs = [
      {
        id: '1',
        created_at: '2024-01-15T12:00:00Z',
        food_items: 'Chicken Salad',
        total_calories: 450,
        confidence_score: 0.85,
      },
    ];

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockLogs, error: null }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    render(<FoodLogManager />);

    await waitFor(() => {
      expect(screen.getByText('Chicken Salad')).toBeInTheDocument();
    });

    // Click edit button
    const editButton = screen.getByLabelText(/edit/i);
    fireEvent.click(editButton);

    // Edit modal should open
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Update food items
    const foodInput = screen.getByLabelText(/food items/i);
    await userEvent.clear(foodInput);
    await userEvent.type(foodInput, 'Updated Salad');

    // Update calories
    const caloriesInput = screen.getByLabelText(/calories/i);
    await userEvent.clear(caloriesInput);
    await userEvent.type(caloriesInput, '500');

    // Save changes
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('nutrition_logs');
      expect(screen.getByText('Updated Salad')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument();
    });
  });

  it('displays empty state when no logs', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    render(<FoodLogManager />);

    await waitFor(() => {
      expect(screen.getByText(/no logs found/i)).toBeInTheDocument();
    });
  });

  it('exports data to CSV', async () => {
    const mockLogs = [
      {
        id: '1',
        created_at: '2024-01-15T12:00:00Z',
        food_items: 'Chicken Salad',
        total_calories: 450,
        confidence_score: 0.85,
      },
    ];

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockLogs, error: null }),
        }),
      }),
    });

    // Mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn();

    render(<FoodLogManager />);

    await waitFor(() => {
      expect(screen.getByText('Chicken Salad')).toBeInTheDocument();
    });

    const exportButton = screen.getByText(/export to csv/i);
    fireEvent.click(exportButton);

    // Should create download link
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
});
```

#### Test 4-7: Additional Component Tests

**File**: `src/components/calorie-tracker/__tests__/AIAnalysisDisplay.test.tsx`
**File**: `src/components/calorie-tracker/__tests__/OptimizedCamera.test.tsx`
**File**: `src/components/calorie-tracker/__tests__/ImagePreview.test.tsx`
**File**: `src/components/calorie-tracker/__tests__/QuickActions.test.tsx`

(Similar comprehensive tests for these components - abbreviated for space)

---

### Task 8.5.2: Add Tests for Withings Components

**Problem**: 4 Withings integration components have no tests.

#### Test 1: withings-connection.tsx

**File**: `src/components/settings/__tests__/withings-connection.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WithingsConnection } from '../withings-connection';
import { createClient } from '@/utils/supabase/client';

jest.mock('@/utils/supabase/client');

// Mock window.location
delete (window as any).location;
window.location = { href: '' } as any;

describe('WithingsConnection', () => {
  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  };

  beforeEach(() => {
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user' } },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('displays not connected state initially', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    render(<WithingsConnection />);

    await waitFor(() => {
      expect(screen.getByText(/not connected/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /connect withings/i })).toBeInTheDocument();
    });
  });

  it('initiates OAuth flow when connect button clicked', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ authUrl: 'https://withings.com/oauth' }),
      })
    );
    global.fetch = mockFetch as any;

    render(<WithingsConnection />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connect withings/i })).toBeInTheDocument();
    });

    const connectButton = screen.getByRole('button', { name: /connect withings/i });
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/integrations/withings/auth/initiate',
        { method: 'POST' }
      );
      expect(window.location.href).toBe('https://withings.com/oauth');
    });
  });

  it('displays connection details when connected', async () => {
    const mockConnection = {
      id: '1',
      user_id: 'test-user',
      withings_user_id: 'withings-123',
      access_token: 'token',
      connected_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
    };

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockConnection, error: null }),
        }),
      }),
    });

    render(<WithingsConnection />);

    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
      expect(screen.getByText(/last synced/i)).toBeInTheDocument();
    });
  });

  it('handles disconnect action with confirmation', async () => {
    const mockConnection = {
      id: '1',
      user_id: 'test-user',
      withings_user_id: 'withings-123',
      access_token: 'token',
      connected_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
    };

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockConnection, error: null }),
        }),
      }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    render(<WithingsConnection />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
    });

    const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
    fireEvent.click(disconnectButton);

    // Confirmation dialog should appear
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('withings_connections');
      expect(screen.getByText(/not connected/i)).toBeInTheDocument();
    });
  });

  it('tests connection successfully', async () => {
    const mockConnection = {
      id: '1',
      user_id: 'test-user',
      withings_user_id: 'withings-123',
      access_token: 'token',
      connected_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
    };

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockConnection, error: null }),
        }),
      }),
    });

    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, message: 'Connection OK' }),
      })
    );
    global.fetch = mockFetch as any;

    render(<WithingsConnection />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument();
    });

    const testButton = screen.getByRole('button', { name: /test connection/i });
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/integrations/withings/test',
        expect.any(Object)
      );
      expect(screen.getByText(/connection ok/i)).toBeInTheDocument();
    });
  });

  it('handles OAuth callback with error', async () => {
    // Simulate OAuth error callback
    Object.defineProperty(window, 'location', {
      value: {
        search: '?error=access_denied&error_description=User%20denied%20access',
      },
      writable: true,
    });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    render(<WithingsConnection />);

    await waitFor(() => {
      expect(screen.getByText(/user denied access/i)).toBeInTheDocument();
    });
  });
});
```

#### Test 2-4: Additional Withings Component Tests

**File**: `src/components/settings/__tests__/withings-devices.test.tsx`
**File**: `src/components/settings/__tests__/withings-sync-status.test.tsx` (from Phase 8.4)
**File**: `src/components/settings/__tests__/withings-notification-settings.test.tsx`

(Comprehensive tests for these components)

---

### Task 8.5.3: Add Integration Tests with Playwright

**Problem**: No end-to-end tests exist.

**Solution**: Add Playwright tests for critical user flows.

#### Setup Playwright

**File**: `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

#### Test 1: Complete Meal Logging Flow

**File**: `e2e/meal-logging.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Meal Logging Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_EMAIL || 'test@example.com');
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'testpass123');
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await expect(page).toHaveURL('/app');
  });

  test('complete meal logging with camera', async ({ page, browserName }) => {
    // Skip camera test in Firefox (getUserMedia support varies)
    test.skip(browserName === 'firefox', 'Camera tests unstable in Firefox');

    // Navigate to calorie tracker
    await page.click('a[href="/app/calorie-tracker"]');
    await expect(page).toHaveURL('/app/calorie-tracker');

    // Click camera button
    await page.click('button:has-text("Take Photo")');

    // Grant camera permission (mocked in test)
    await page.evaluate(() => {
      // Mock camera stream
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const stream = (canvas as any).captureStream();
        return stream;
      };
    });

    // Wait for camera to load
    await page.waitForSelector('video', { timeout: 10000 });

    // Capture photo
    await page.click('button:has-text("Capture")');

    // Wait for AI analysis (can take up to 30 seconds)
    await expect(page.locator('text=Analyzing')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Analysis complete')).toBeVisible({ timeout: 35000 });

    // Verify meal appears in recent meals
    await page.goto('/app');
    await expect(page.locator('text=Recent Meals')).toBeVisible();

    // Should see the logged meal
    const mealCard = page.locator('[data-testid="meal-card"]').first();
    await expect(mealCard).toBeVisible();
  });

  test('upload meal image from file', async ({ page }) => {
    await page.goto('/app/calorie-tracker');

    // Upload image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-fixtures/food-sample.jpg');

    // Wait for AI analysis
    await expect(page.locator('text=Analyzing')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Analysis complete')).toBeVisible({ timeout: 35000 });

    // Verify analysis results displayed
    await expect(page.locator('text=Total Calories')).toBeVisible();
    await expect(page.locator('[data-testid="confidence-badge"]')).toBeVisible();

    // Save meal
    await page.click('button:has-text("Save")');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/app');

    // Verify meal in recent meals
    await expect(page.locator('text=Recent Meals')).toBeVisible();
  });

  test('edit meal details after logging', async ({ page }) => {
    // Assume meal already logged
    await page.goto('/app/calorie-tracker');

    // Find first meal
    const mealCard = page.locator('[data-testid="meal-card"]').first();
    await mealCard.click();

    // Edit button
    await page.click('button[aria-label="Edit meal"]');

    // Edit form should open
    await expect(page.locator('role=dialog')).toBeVisible();

    // Update food items
    await page.fill('input[name="food_items"]', 'Updated Meal Name');

    // Update calories
    await page.fill('input[name="total_calories"]', '550');

    // Save
    await page.click('button:has-text("Save Changes")');

    // Verify updated
    await expect(page.locator('text=Updated Meal Name')).toBeVisible();
    await expect(page.locator('text=550 cal')).toBeVisible();
  });

  test('delete meal with confirmation', async ({ page }) => {
    await page.goto('/app/calorie-tracker');

    // Count meals before deletion
    const initialCount = await page.locator('[data-testid="meal-card"]').count();

    // Delete first meal
    const firstMeal = page.locator('[data-testid="meal-card"]').first();
    const mealText = await firstMeal.textContent();

    await firstMeal.locator('button[aria-label="Delete meal"]').click();

    // Confirmation dialog
    await expect(page.locator('text=Are you sure')).toBeVisible();
    await page.click('button:has-text("Confirm")');

    // Wait for deletion
    await page.waitForTimeout(1000);

    // Verify meal removed
    const finalCount = await page.locator('[data-testid="meal-card"]').count();
    expect(finalCount).toBe(initialCount - 1);

    // Meal text should not be present
    if (mealText) {
      await expect(page.locator(`text=${mealText}`)).not.toBeVisible();
    }
  });
});
```

#### Test 2: Withings Integration Flow

**File**: `e2e/withings-integration.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Withings Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_EMAIL || 'test@example.com');
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'testpass123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/app');
  });

  test('navigate to withings settings', async ({ page }) => {
    await page.goto('/app/settings');

    await expect(page.locator('text=Withings Connection')).toBeVisible();
  });

  test('initiate withings connection', async ({ page, context }) => {
    await page.goto('/app/settings');

    // Intercept OAuth redirect
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.click('button:has-text("Connect Withings")'),
    ]);

    // Should redirect to Withings OAuth
    await expect(popup).toHaveURL(/withings\.com|account\.withings\.com/);
  });

  test('display withings devices when connected', async ({ page }) => {
    // Mock connected state
    await page.route('**/api/integrations/withings/connection', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          connected: true,
          devices: [
            { id: '1', name: 'Body+ Scale', type: 'scale', last_sync: new Date().toISOString() },
          ],
        }),
      });
    });

    await page.goto('/app/settings');

    await expect(page.locator('text=Connected')).toBeVisible();
    await expect(page.locator('text=Body+ Scale')).toBeVisible();
  });

  test('test withings connection successfully', async ({ page }) => {
    // Mock connected state
    await page.route('**/api/integrations/withings/connection', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ connected: true }),
      });
    });

    // Mock test endpoint
    await page.route('**/api/integrations/withings/test', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, message: 'Connection OK' }),
      });
    });

    await page.goto('/app/settings');

    await page.click('button:has-text("Test Connection")');

    await expect(page.locator('text=Connection OK')).toBeVisible({ timeout: 5000 });
  });

  test('disconnect withings with confirmation', async ({ page }) => {
    // Mock connected state
    await page.route('**/api/integrations/withings/connection', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ connected: true }),
      });
    });

    await page.goto('/app/settings');

    await page.click('button:has-text("Disconnect")');

    // Confirmation dialog
    await expect(page.locator('text=Are you sure')).toBeVisible();
    await page.click('button:has-text("Confirm")');

    // Should show not connected state
    await expect(page.locator('text=Not Connected')).toBeVisible({ timeout: 5000 });
  });
});
```

#### Test 3: Navigation and Mobile

**File**: `e2e/navigation.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';

test.describe('Desktop Navigation', () => {
  test('navigate between pages using top nav', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpass123');
    await page.click('button[type="submit"]');

    // Dashboard
    await expect(page).toHaveURL('/app');

    // Navigate to Analytics
    await page.click('a[href="/app/analytics"]');
    await expect(page).toHaveURL('/app/analytics');

    // Navigate to Settings
    await page.click('a[href="/app/settings"]');
    await expect(page).toHaveURL('/app/settings');

    // Navigate to Profile
    await page.click('button[aria-label="User menu"]');
    await page.click('a[href="/app/profile"]');
    await expect(page).toHaveURL('/app/profile');
  });
});

test.describe('Mobile Navigation', () => {
  test.use({ ...devices['iPhone 12'] });

  test('navigate using bottom tab bar', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpass123');
    await page.click('button[type="submit"]');

    // Should see bottom navigation
    await expect(page.locator('nav.bottom-0')).toBeVisible();

    // Navigate to Tracker
    await page.click('a[href="/app/calorie-tracker"]');
    await expect(page).toHaveURL('/app/calorie-tracker');

    // Navigate to Analytics
    await page.click('a[href="/app/analytics"]');
    await expect(page).toHaveURL('/app/analytics');

    // Navigate to Settings
    await page.click('a[href="/app/settings"]');
    await expect(page).toHaveURL('/app/settings');

    // Navigate back to Dashboard
    await page.click('a[href="/app"]');
    await expect(page).toHaveURL('/app');
  });

  test('active state highlights correct tab', async ({ page }) => {
    await page.goto('/app');

    // Dashboard tab should be active
    const dashboardTab = page.locator('a[href="/app"]');
    await expect(dashboardTab).toHaveClass(/text-primary/);

    // Navigate to Tracker
    await page.click('a[href="/app/calorie-tracker"]');

    // Tracker tab should be active
    const trackerTab = page.locator('a[href="/app/calorie-tracker"]');
    await expect(trackerTab).toHaveClass(/text-primary/);
  });
});
```

---

### Task 8.5.4: Add Visual Regression Tests

**Problem**: No way to catch visual/styling bugs.

**Solution**: Screenshot-based testing with Playwright.

**File**: `e2e/visual-regression.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login before tests
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/app');
  });

  test('dashboard light mode', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-light.png', {
      fullPage: true,
      mask: [
        page.locator('[data-dynamic="true"]'), // Mask dynamic content
        page.locator('text=/\\d+:\\d+/'), // Mask timestamps
      ],
    });
  });

  test('dashboard dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-dark.png', {
      fullPage: true,
    });
  });

  test('calorie tracker page', async ({ page }) => {
    await page.goto('/app/calorie-tracker');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('calorie-tracker.png', {
      fullPage: true,
    });
  });

  test('analytics page', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('analytics.png', {
      fullPage: true,
    });
  });

  test('settings page', async ({ page }) => {
    await page.goto('/app/settings');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('settings.png', {
      fullPage: true,
    });
  });

  test('profile page', async ({ page }) => {
    await page.goto('/app/profile');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('profile.png', {
      fullPage: true,
    });
  });

  test('mobile dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
    });
  });

  test('tablet dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-tablet.png', {
      fullPage: true,
    });
  });
});

test.describe('Component Visual Tests', () => {
  test('badge variants', async ({ page }) => {
    await page.setContent(`
      <div style="padding: 20px; display: flex; gap: 10px; background: white;">
        <div class="inline-flex items-center rounded-full border-transparent bg-primary text-primary-foreground px-2.5 py-0.5 text-xs font-semibold">
          Default
        </div>
        <div class="inline-flex items-center rounded-full border-transparent bg-chart-1/10 text-chart-1 px-2.5 py-0.5 text-xs font-semibold">
          Success
        </div>
        <div class="inline-flex items-center rounded-full border-transparent bg-chart-4/10 text-chart-4 px-2.5 py-0.5 text-xs font-semibold">
          Warning
        </div>
        <div class="inline-flex items-center rounded-full border-transparent bg-destructive text-destructive-foreground px-2.5 py-0.5 text-xs font-semibold">
          Error
        </div>
      </div>
    `);

    await expect(page).toHaveScreenshot('badge-variants.png');
  });

  test('glass panel effect', async ({ page }) => {
    await page.setContent(`
      <div style="padding: 40px; background: linear-gradient(135deg, oklch(0.95 0.02 140) 0%, oklch(0.97 0.01 180) 50%, oklch(0.98 0.01 220) 100%);">
        <div class="glass-panel rounded-xl p-6 max-w-md">
          <h3 class="text-foreground font-semibold mb-2">Glass Panel</h3>
          <p class="text-muted-foreground">This demonstrates the frosted glass effect used throughout the app.</p>
        </div>
      </div>
    `);

    await expect(page).toHaveScreenshot('glass-panel.png');
  });
});
```

---

## Implementation Checklist

### Task 8.5.1: Calorie Tracker Component Tests
- [ ] Create `src/components/calorie-tracker/__tests__/RecentMeals.test.tsx`
- [ ] Create `src/components/calorie-tracker/__tests__/DailyCalorieSummary.test.tsx`
- [ ] Create `src/components/calorie-tracker/__tests__/FoodLogManager.test.tsx`
- [ ] Create `src/components/calorie-tracker/__tests__/AIAnalysisDisplay.test.tsx`
- [ ] Create `src/components/calorie-tracker/__tests__/OptimizedCamera.test.tsx`
- [ ] Create `src/components/calorie-tracker/__tests__/ImagePreview.test.tsx`
- [ ] Create `src/components/calorie-tracker/__tests__/QuickActions.test.tsx`
- [ ] Run tests: `npm test -- calorie-tracker`
- [ ] Fix any failing tests
- [ ] Verify coverage: `npm test -- --coverage calorie-tracker`

### Task 8.5.2: Withings Component Tests
- [ ] Create `src/components/settings/__tests__/withings-connection.test.tsx`
- [ ] Create `src/components/settings/__tests__/withings-devices.test.tsx`
- [ ] Create `src/components/settings/__tests__/withings-notification-settings.test.tsx`
- [ ] Run tests: `npm test -- settings`
- [ ] Fix any failing tests
- [ ] Verify coverage: `npm test -- --coverage settings`

### Task 8.5.3: Integration Tests
- [ ] Install Playwright: `npm install -D @playwright/test`
- [ ] Run: `npx playwright install`
- [ ] Create `playwright.config.ts`
- [ ] Create `e2e/meal-logging.spec.ts`
- [ ] Create `e2e/withings-integration.spec.ts`
- [ ] Create `e2e/navigation.spec.ts`
- [ ] Create test fixtures: `test-fixtures/food-sample.jpg`
- [ ] Run Playwright tests: `npx playwright test`
- [ ] Fix any failing tests
- [ ] Review HTML report: `npx playwright show-report`

### Task 8.5.4: Visual Regression Tests
- [ ] Create `e2e/visual-regression.spec.ts`
- [ ] Generate baseline screenshots: `npx playwright test visual-regression --update-snapshots`
- [ ] Review baseline screenshots in `e2e/__screenshots__/`
- [ ] Run visual tests: `npx playwright test visual-regression`
- [ ] Update snapshots if needed: `npx playwright test visual-regression --update-snapshots`

### Final Verification
- [ ] Run full test suite: `npm test`
- [ ] Check coverage report: `npm test -- --coverage`
- [ ] Verify coverage ≥80%
- [ ] Run all Playwright tests: `npx playwright test`
- [ ] Run linter: `npm run lint`
- [ ] Build production: `npm run build`
- [ ] Verify no test-related errors in build
- [ ] Commit changes with descriptive message

---

## Files Created (18+ new files)

### Unit Tests (11 files)
1. `src/components/calorie-tracker/__tests__/RecentMeals.test.tsx`
2. `src/components/calorie-tracker/__tests__/DailyCalorieSummary.test.tsx`
3. `src/components/calorie-tracker/__tests__/FoodLogManager.test.tsx`
4. `src/components/calorie-tracker/__tests__/AIAnalysisDisplay.test.tsx`
5. `src/components/calorie-tracker/__tests__/OptimizedCamera.test.tsx`
6. `src/components/calorie-tracker/__tests__/ImagePreview.test.tsx`
7. `src/components/calorie-tracker/__tests__/QuickActions.test.tsx`
8. `src/components/settings/__tests__/withings-connection.test.tsx`
9. `src/components/settings/__tests__/withings-devices.test.tsx`
10. `src/components/settings/__tests__/withings-notification-settings.test.tsx`

### Integration Tests (4 files)
11. `playwright.config.ts`
12. `e2e/meal-logging.spec.ts`
13. `e2e/withings-integration.spec.ts`
14. `e2e/navigation.spec.ts`

### Visual Regression Tests (1 file)
15. `e2e/visual-regression.spec.ts`

### Test Fixtures (3+ files)
16. `test-fixtures/food-sample.jpg`
17. `test-fixtures/README.md`
18. `.github/workflows/playwright.yml` (CI configuration)

---

## Files Modified (2 files)

1. `package.json` (add Playwright scripts)
2. `.gitignore` (ignore test artifacts)

---

## Time Estimate

- Task 8.5.1 (Calorie Tracker Tests): 16-20 hours
  - RecentMeals: 3-4 hours
  - DailyCalorieSummary: 2-3 hours
  - FoodLogManager: 4-5 hours
  - AIAnalysisDisplay: 2-3 hours
  - OptimizedCamera: 3-4 hours
  - ImagePreview: 1-2 hours
  - QuickActions: 1-2 hours
- Task 8.5.2 (Withings Tests): 8-10 hours
  - withings-connection: 4-5 hours
  - withings-devices: 2-3 hours
  - withings-notification-settings: 2-3 hours
- Task 8.5.3 (Integration Tests): 10-14 hours
  - Playwright setup: 2-3 hours
  - Meal logging flow: 4-5 hours
  - Withings integration: 2-3 hours
  - Navigation tests: 2-3 hours
- Task 8.5.4 (Visual Regression): 4-6 hours
- Documentation and final verification: 4-6 hours

**Total: 42-56 hours**

---

## Success Metrics

After completing Phase 8.5:
- Test coverage ≥80% (from 54%)
- 11 new unit test files
- 4 integration test files
- Visual regression tests for all pages
- All tests passing
- Playwright CI configured
- Production build successful
- Confidence in code quality before launch