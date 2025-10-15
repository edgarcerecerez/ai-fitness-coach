import React from 'react'
import { render, screen } from '@testing-library/react'
import { createClient } from '@/utils/supabase/server'
import AppDashboard from '../page'
import '@testing-library/jest-dom'

// Mock the Supabase client
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn()
}))

// Mock the dashboard components
jest.mock('@/components/dashboard-preview', () => ({
  WeightProgressChart: () => <div data-testid="weight-chart">Weight Chart</div>,
  CalorieIntakeChart: () => <div data-testid="calorie-chart">Calorie Chart</div>,
  MoodSleepChart: () => <div data-testid="mood-sleep-chart">Mood Sleep Chart</div>
}))

// Mock Next.js components
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  Camera: ({ className }: { className: string }) => <div className={className} data-testid="camera-icon">Camera</div>,
  Calendar: ({ className }: { className: string }) => <div className={className} data-testid="calendar-icon">Calendar</div>
}))

// Mock the logger
jest.mock('@/lib/logger', () => ({
  clientLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  logError: jest.fn(),
  logAuthEvent: jest.fn()
}))

describe('AppDashboard', () => {
  const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the dashboard with glass panels and themed colors', async () => {
    // Mock Supabase responses
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id', email: 'test@example.com' } },
          error: null
        })
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                full_name: 'Test User',
                weight_kg: 70,
                fitness_goals: ['Weight Loss', 'Muscle Gain']
              }
            }))
          }))
        }))
      }))
    }

    // Mock the Promise.all responses
    const mockProfileResult = { data: { full_name: 'Test User', weight_kg: 70, fitness_goals: ['Weight Loss'] } }
    const mockNutritionResult = {
      data: [{
        id: '1',
        created_at: new Date().toISOString(),
        total_calories: 500,
        food_items: 'Grilled Chicken Salad',
        image_url: 'https://example.com/image.jpg',
        confidence_score: 0.95
      }]
    }

    mockCreateClient.mockResolvedValue(mockSupabase as any)
    mockSupabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve(mockProfileResult),
          order: () => ({
            limit: () => Promise.resolve(mockNutritionResult)
          })
        })
      })
    })

    // Mock the user data
    const mockUser = { id: 'test-user-id', email: 'test@example.com' }

    // Render the component
    const { container } = render(await AppDashboard())

    // Check for glass panels
    expect(container.querySelector('.glass-panel')).toBeInTheDocument()

    // Check for background image
    expect(container.querySelector('img[src="/images/training-background-image.png"]')).toBeInTheDocument()

    // Check for themed colors (these should be present, not hardcoded grays)
    expect(container.querySelector('.text-card-foreground')).toBeInTheDocument()
    expect(container.querySelector('.text-muted-foreground')).toBeInTheDocument()
    expect(container.querySelector('.bg-secondary\\/30')).toBeInTheDocument()

    // Check for glass buttons
    expect(container.querySelector('.glass-button')).toBeInTheDocument()

    // Check for icons with proper theming
    expect(container.querySelector('[data-testid="camera-icon"]')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="calendar-icon"]')).toBeInTheDocument()

    // Check that charts are rendered in glass panels
    expect(container.querySelector('[data-testid="weight-chart"]')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="calorie-chart"]')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="mood-sleep-chart"]')).toBeInTheDocument()
  })

  it('renders empty state when no meals are logged', async () => {
    // Mock Supabase responses with no nutrition data
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id', email: 'test@example.com' } },
          error: null
        })
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                full_name: 'Test User',
                weight_kg: 70,
                fitness_goals: []
              }
            }))
          }))
        }))
      }))
    }

    const mockNutritionResult = { data: [] }

    mockCreateClient.mockResolvedValue(mockSupabase as any)
    mockSupabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { full_name: 'Test User', weight_kg: 70, fitness_goals: [] } }),
          order: () => ({
            limit: () => Promise.resolve(mockNutritionResult)
          })
        })
      })
    })

    const { container } = render(await AppDashboard())

    // Check for empty state message
    expect(screen.getByText('No meals logged yet')).toBeInTheDocument()

    // Check for glass button in empty state
    expect(container.querySelector('.glass-button')).toBeInTheDocument()
  })

  it('displays fitness goals as badges with proper theming', async () => {
    // Mock Supabase responses with fitness goals
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id', email: 'test@example.com' } },
          error: null
        })
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                full_name: 'Test User',
                weight_kg: 70,
                fitness_goals: ['Weight Loss', 'Muscle Gain', 'Endurance']
              }
            }))
          }))
        }))
      }))
    }

    const mockNutritionResult = { data: [] }

    mockCreateClient.mockResolvedValue(mockSupabase as any)
    mockSupabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: {
              full_name: 'Test User',
              weight_kg: 70,
              fitness_goals: ['Weight Loss', 'Muscle Gain', 'Endurance']
            }
          }),
          order: () => ({
            limit: () => Promise.resolve(mockNutritionResult)
          })
        })
      })
    })

    const { container } = render(await AppDashboard())

    // Check for fitness goals badges
    expect(screen.getByText('Weight Loss')).toBeInTheDocument()
    expect(screen.getByText('Muscle Gain')).toBeInTheDocument()

    // Check for themed badge styling
    const badges = container.querySelectorAll('.text-card-foreground.border-primary\\/30')
    expect(badges.length).toBeGreaterThan(0)
  })
})

