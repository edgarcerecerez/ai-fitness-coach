import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProfileForm } from '../profile-form'
import { createClient } from '@/utils/supabase/client'

jest.mock('@/utils/supabase/client')
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
}))

describe('ProfileForm', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  }

  beforeEach(() => {
    ;(createClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })
  })

  it('renders all form fields', () => {
    render(<ProfileForm user={mockUser as any} />)

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/age/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/gender/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/height/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/weight/i)).toBeInTheDocument()
  })

  it('populates form with initial profile data', () => {
    const mockProfile = {
      id: 'test-user-id',
      full_name: 'Test User',
      age: 30,
      gender: 'male' as const,
      height_cm: 180,
      weight_kg: 75,
      activity_level: 'moderately_active' as const,
      fitness_goals: ['Lose weight', 'General health'],
      dietary_preferences: [],
      target_daily_calories: 2000,
    }

    render(<ProfileForm user={mockUser as any} initialProfile={mockProfile} />)

    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
    expect(screen.getByDisplayValue('30')).toBeInTheDocument()
    expect(screen.getByDisplayValue('180')).toBeInTheDocument()
  })

  it('submits form successfully', async () => {
    const mockUpsert = jest.fn(() => Promise.resolve({ data: null, error: null }))
    ;(createClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        upsert: mockUpsert,
      })),
    })

    render(<ProfileForm user={mockUser as any} />)

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'John Doe' },
    })

    fireEvent.click(screen.getByText('Save Profile'))

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled()
      expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument()
    })
  })

  it('displays error message on failure', async () => {
    ;(createClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        upsert: jest.fn(() => Promise.resolve({
          data: null,
          error: new Error('Database error')
        })),
      })),
    })

    render(<ProfileForm user={mockUser as any} />)

    fireEvent.click(screen.getByText('Save Profile'))

    await waitFor(() => {
      expect(screen.getByText(/database error/i)).toBeInTheDocument()
    })
  })
})