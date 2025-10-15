# Phase 8.1: Critical Fixes - Technical Implementation

## Summary

**Goal**: Fix production-blocking issues that prevent mobile users from navigating the app and eliminate critical code quality violations.

**Priority**: 🔴 CRITICAL
**Duration**: Week 1 (40-50 hours)
**Dependencies**: None - these fixes are foundational

### What We're Achieving

This phase addresses three critical production blockers discovered in the architectural audit:

1. **Mobile Navigation Gap** - Users cannot navigate between app sections on mobile devices (navigation hidden with `md:hidden`)
2. **Duplicate Profile Code** - Two identical 678-line profile pages violating DRY principles
3. **Code Duplication** - Confidence score logic and constants repeated across 8+ files

**Impact**: Without these fixes, the app is unusable on mobile and unmaintainable at scale.

### Success Criteria

- [ ] Mobile users can navigate between all app sections
- [ ] Profile code reduced from 1,361 lines to ~200 lines (shared component)
- [ ] Confidence score logic consolidated into 1 shared utility file
- [ ] All tests passing
- [ ] No regression in existing functionality

---

## Technical Implementation

### Task 8.1.1: Create Mobile Navigation Component

**Problem**: Desktop navigation uses `hidden md:flex`, leaving mobile users with no navigation.

**Solution**: Implement bottom tab bar navigation for mobile devices.

#### Files to Create

**File**: `src/components/app/mobile-navigation.tsx`

```typescript
"use client"

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, Camera, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigationItems = [
  { name: 'Dashboard', href: '/app', icon: Home },
  { name: 'Tracker', href: '/app/calorie-tracker', icon: Camera },
  { name: 'Analytics', href: '/app/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/app/settings', icon: Settings },
] as const

export function MobileNavigation() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-white/20 md:hidden safe-area-bottom">
      <div className="grid grid-cols-4 h-16">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-xs transition-all duration-200 min-h-[44px] min-w-[44px]",
                isActive
                  ? "text-primary bg-primary/10 rounded-lg mx-1 my-1"
                  : "text-muted-foreground hover:text-foreground active:bg-primary/5"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "scale-110")} />
              <span className="text-[10px]">{item.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

#### Files to Update

**File**: `src/app/app/layout.tsx`

Add mobile navigation import and include in layout:

```typescript
import { MobileNavigation } from '@/components/app/mobile-navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // ... existing code ...

  return (
    <div className="min-h-screen app-gradient-bg">
      <AppNavigation user={user} />
      <main className="container mx-auto px-4 py-8 pb-20 md:pb-8">
        {children}
      </main>
      <MobileNavigation />
      <Toaster />
    </div>
  )
}
```

**File**: `src/app/globals.css`

Add iOS safe area support:

```css
@layer utilities {
  .safe-area-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

#### Testing

**File**: `src/components/app/__tests__/mobile-navigation.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import { MobileNavigation } from '../mobile-navigation'
import { usePathname } from 'next/navigation'

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}))

describe('MobileNavigation', () => {
  it('renders all navigation items', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/app')

    render(<MobileNavigation />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Tracker')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('highlights active navigation item', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/app/calorie-tracker')

    render(<MobileNavigation />)

    const trackerLink = screen.getByText('Tracker').closest('a')
    expect(trackerLink).toHaveClass('text-primary')
  })

  it('is hidden on desktop', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/app')

    const { container } = render(<MobileNavigation />)
    const nav = container.querySelector('nav')

    expect(nav).toHaveClass('md:hidden')
  })

  it('has touch-safe targets (44px minimum)', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/app')

    const { container } = render(<MobileNavigation />)
    const links = container.querySelectorAll('a')

    links.forEach(link => {
      expect(link).toHaveClass('min-h-[44px]')
      expect(link).toHaveClass('min-w-[44px]')
    })
  })
})
```

---

### Task 8.1.2: Deduplicate Profile Pages

**Problem**: Two identical 678-line profile pages exist:
- `src/app/profile/page.tsx` (old location)
- `src/app/app/profile/page.tsx` (new location)

**Solution**: Extract shared `ProfileForm` component and shared constants.

#### Files to Create

**File**: `src/lib/constants/profile.ts`

```typescript
export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const

export const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary (little to no exercise)' },
  { value: 'lightly_active', label: 'Lightly Active (1-3 days/week)' },
  { value: 'moderately_active', label: 'Moderately Active (3-5 days/week)' },
  { value: 'very_active', label: 'Very Active (6-7 days/week)' },
  { value: 'extremely_active', label: 'Extremely Active (physical job + exercise)' },
] as const

export const FITNESS_GOALS = [
  'Lose weight',
  'Gain muscle',
  'Maintain weight',
  'Improve endurance',
  'Improve flexibility',
  'General health',
  'Better sleep',
  'Stress management',
] as const

export const DIETARY_PREFERENCES = [
  { value: 'none', label: 'No restrictions' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'keto', label: 'Ketogenic' },
  { value: 'paleo', label: 'Paleo' },
  { value: 'gluten_free', label: 'Gluten-free' },
  { value: 'dairy_free', label: 'Dairy-free' },
] as const

export type GenderOption = typeof GENDER_OPTIONS[number]['value']
export type ActivityLevel = typeof ACTIVITY_LEVELS[number]['value']
export type FitnessGoal = typeof FITNESS_GOALS[number]
export type DietaryPreference = typeof DIETARY_PREFERENCES[number]['value']
```

**File**: `src/components/profile/profile-form.tsx`

```typescript
"use client"

import { useState } from 'react'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusAlert } from '@/components/ui/status-alert'
import {
  GENDER_OPTIONS,
  ACTIVITY_LEVELS,
  FITNESS_GOALS,
  DIETARY_PREFERENCES,
  type GenderOption,
  type ActivityLevel,
  type FitnessGoal,
  type DietaryPreference
} from '@/lib/constants/profile'

interface UserProfile {
  id: string
  full_name: string | null
  age: number | null
  gender: GenderOption | null
  height_cm: number | null
  weight_kg: number | null
  activity_level: ActivityLevel | null
  fitness_goals: FitnessGoal[]
  dietary_preferences: DietaryPreference[]
  target_daily_calories: number | null
}

interface ProfileFormProps {
  user: User
  initialProfile?: UserProfile | null
  onSuccess?: () => void
}

export function ProfileForm({ user, initialProfile, onSuccess }: ProfileFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)

  // Form state
  const [fullName, setFullName] = useState(initialProfile?.full_name || '')
  const [age, setAge] = useState(initialProfile?.age?.toString() || '')
  const [gender, setGender] = useState<GenderOption | ''>(initialProfile?.gender || '')
  const [heightCm, setHeightCm] = useState(initialProfile?.height_cm?.toString() || '')
  const [weightKg, setWeightKg] = useState(initialProfile?.weight_kg?.toString() || '')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | ''>(initialProfile?.activity_level || '')
  const [fitnessGoals, setFitnessGoals] = useState<FitnessGoal[]>(initialProfile?.fitness_goals || [])
  const [dietaryPreferences, setDietaryPreferences] = useState<DietaryPreference[]>(
    initialProfile?.dietary_preferences || []
  )
  const [targetCalories, setTargetCalories] = useState(
    initialProfile?.target_daily_calories?.toString() || ''
  )

  const handleFitnessGoalToggle = (goal: FitnessGoal) => {
    setFitnessGoals(prev =>
      prev.includes(goal)
        ? prev.filter(g => g !== goal)
        : [...prev, goal]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const supabase = createClient()

      const profileData = {
        id: user.id,
        full_name: fullName || null,
        age: age ? parseInt(age) : null,
        gender: gender || null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        activity_level: activityLevel || null,
        fitness_goals: fitnessGoals,
        dietary_preferences: dietaryPreferences,
        target_daily_calories: targetCalories ? parseInt(targetCalories) : null,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('user_profiles')
        .upsert(profileData)

      if (error) throw error

      setMessage({ type: 'success', text: 'Profile updated successfully!' })

      if (onSuccess) {
        onSuccess()
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update profile'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <StatusAlert
          variant={message.type}
          message={message.text}
        />
      )}

      {/* Personal Information */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Personal Information</h2>

        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              min="13"
              max="120"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="25"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select value={gender} onValueChange={(value) => setGender(value as GenderOption)}>
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="height">Height (cm)</Label>
            <Input
              id="height"
              type="number"
              min="50"
              max="300"
              step="0.1"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="170"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input
              id="weight"
              type="number"
              min="20"
              max="500"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="70"
            />
          </div>
        </div>
      </div>

      {/* Activity & Goals */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Activity & Goals</h2>

        <div className="space-y-2">
          <Label htmlFor="activityLevel">Activity Level</Label>
          <Select value={activityLevel} onValueChange={(value) => setActivityLevel(value as ActivityLevel)}>
            <SelectTrigger>
              <SelectValue placeholder="Select activity level" />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_LEVELS.map(level => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Fitness Goals (select all that apply)</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FITNESS_GOALS.map(goal => (
              <div key={goal} className="flex items-center space-x-2">
                <Checkbox
                  id={goal}
                  checked={fitnessGoals.includes(goal)}
                  onCheckedChange={() => handleFitnessGoalToggle(goal)}
                />
                <Label htmlFor={goal} className="font-normal cursor-pointer">
                  {goal}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetCalories">Target Daily Calories</Label>
          <Input
            id="targetCalories"
            type="number"
            min="500"
            max="10000"
            value={targetCalories}
            onChange={(e) => setTargetCalories(e.target.value)}
            placeholder="2000"
          />
        </div>
      </div>

      {/* Dietary Preferences */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Dietary Preferences</h2>

        <div className="space-y-2">
          <Label>Dietary Restrictions (select all that apply)</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DIETARY_PREFERENCES.map(pref => (
              <div key={pref.value} className="flex items-center space-x-2">
                <Checkbox
                  id={pref.value}
                  checked={dietaryPreferences.includes(pref.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setDietaryPreferences([...dietaryPreferences, pref.value])
                    } else {
                      setDietaryPreferences(dietaryPreferences.filter(p => p !== pref.value))
                    }
                  }}
                />
                <Label htmlFor={pref.value} className="font-normal cursor-pointer">
                  {pref.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Saving...' : 'Save Profile'}
      </Button>
    </form>
  )
}
```

#### Files to Update

**File**: `src/app/app/profile/page.tsx` (reduce from 683 lines to ~30 lines)

```typescript
import { ProfileForm } from '@/components/profile/profile-form'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-6">Profile Settings</h1>
        <ProfileForm user={user} initialProfile={profile} />
      </div>
    </div>
  )
}
```

**File**: `src/app/profile/page.tsx` (optional - can be removed if not needed)

Update to use the same shared component or redirect to `/app/profile`.

#### Testing

**File**: `src/components/profile/__tests__/profile-form.test.tsx`

```typescript
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
```

**File**: `src/lib/constants/__tests__/profile.test.ts`

```typescript
import {
  GENDER_OPTIONS,
  ACTIVITY_LEVELS,
  FITNESS_GOALS,
  DIETARY_PREFERENCES,
} from '../profile'

describe('Profile Constants', () => {
  it('exports gender options', () => {
    expect(GENDER_OPTIONS).toHaveLength(4)
    expect(GENDER_OPTIONS[0]).toHaveProperty('value')
    expect(GENDER_OPTIONS[0]).toHaveProperty('label')
  })

  it('exports activity levels', () => {
    expect(ACTIVITY_LEVELS).toHaveLength(5)
    expect(ACTIVITY_LEVELS[0].value).toBe('sedentary')
  })

  it('exports fitness goals', () => {
    expect(FITNESS_GOALS).toContain('Lose weight')
    expect(FITNESS_GOALS).toContain('Gain muscle')
  })

  it('exports dietary preferences', () => {
    expect(DIETARY_PREFERENCES).toHaveLength(8)
    expect(DIETARY_PREFERENCES[0].value).toBe('none')
  })
})
```

---

### Task 8.1.3: Create Shared Nutrition Utility Functions

**Problem**: Confidence score logic duplicated in 4+ files:
- `src/components/calorie-tracker/FoodLogManager.tsx`
- `src/components/calorie-tracker/meal-log.tsx`
- `src/components/calorie-tracker/RecentMeals.tsx`
- `src/components/calorie-tracker/AIAnalysisDisplay.tsx`

**Solution**: Create shared utility functions.

#### Files to Create

**File**: `src/lib/nutrition-helpers.ts`

```typescript
export type ConfidenceLevel = 'high' | 'medium' | 'low'

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.8) return 'high'
  if (score >= 0.6) return 'medium'
  return 'low'
}

export function getConfidenceColor(score: number): string {
  const level = getConfidenceLevel(score)
  switch (level) {
    case 'high': return 'text-chart-1' // Green in theme
    case 'medium': return 'text-chart-4' // Yellow in theme
    case 'low': return 'text-destructive' // Red in theme
  }
}

export function getConfidenceBadgeVariant(
  score: number
): 'success' | 'warning' | 'destructive' {
  const level = getConfidenceLevel(score)
  switch (level) {
    case 'high': return 'success'
    case 'medium': return 'warning'
    case 'low': return 'destructive'
  }
}

export function getConfidenceText(score: number): string {
  const level = getConfidenceLevel(score)
  switch (level) {
    case 'high': return 'High Confidence'
    case 'medium': return 'Medium Confidence'
    case 'low': return 'Low Confidence'
  }
}

export function formatCalories(calories: number | null | undefined): string {
  if (calories === null || calories === undefined) return '0 cal'
  return `${Math.round(calories)} cal`
}

export function calculateDailyTotal(
  logs: Array<{ total_calories: number | null; created_at: string }>
): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return logs.reduce((total, log) => {
    const logDate = new Date(log.created_at)
    logDate.setHours(0, 0, 0, 0)

    if (logDate.getTime() === today.getTime()) {
      return total + (log.total_calories ?? 0)
    }
    return total
  }, 0)
}

export function formatConfidencePercentage(score: number): string {
  return `${Math.round(score * 100)}%`
}
```

#### Files to Update

Update all files that have duplicated confidence score logic:

**File**: `src/components/calorie-tracker/FoodLogManager.tsx`

```typescript
// Before (lines 198-200):
{score >= 0.8 ? (
  <Badge className="bg-green-100 text-green-800">High</Badge>
) : score >= 0.6 ? (
  <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>
) : (
  <Badge className="bg-red-100 text-red-800">Low</Badge>
)}

// After:
import { getConfidenceBadgeVariant, getConfidenceText } from '@/lib/nutrition-helpers'

<Badge variant={getConfidenceBadgeVariant(score)}>
  {getConfidenceText(score)}
</Badge>
```

Apply same changes to:
- `src/components/calorie-tracker/meal-log.tsx`
- `src/components/calorie-tracker/RecentMeals.tsx`
- `src/components/calorie-tracker/AIAnalysisDisplay.tsx`

#### Testing

**File**: `src/lib/__tests__/nutrition-helpers.test.ts`

```typescript
import {
  getConfidenceLevel,
  getConfidenceColor,
  getConfidenceBadgeVariant,
  getConfidenceText,
  formatCalories,
  calculateDailyTotal,
  formatConfidencePercentage,
} from '../nutrition-helpers'

describe('nutrition-helpers', () => {
  describe('getConfidenceLevel', () => {
    it('returns high for scores >= 0.8', () => {
      expect(getConfidenceLevel(0.8)).toBe('high')
      expect(getConfidenceLevel(0.9)).toBe('high')
      expect(getConfidenceLevel(1.0)).toBe('high')
    })

    it('returns medium for scores >= 0.6 and < 0.8', () => {
      expect(getConfidenceLevel(0.6)).toBe('medium')
      expect(getConfidenceLevel(0.7)).toBe('medium')
      expect(getConfidenceLevel(0.79)).toBe('medium')
    })

    it('returns low for scores < 0.6', () => {
      expect(getConfidenceLevel(0.0)).toBe('low')
      expect(getConfidenceLevel(0.5)).toBe('low')
      expect(getConfidenceLevel(0.59)).toBe('low')
    })
  })

  describe('getConfidenceColor', () => {
    it('returns correct theme color for each level', () => {
      expect(getConfidenceColor(0.9)).toBe('text-chart-1')
      expect(getConfidenceColor(0.7)).toBe('text-chart-4')
      expect(getConfidenceColor(0.5)).toBe('text-destructive')
    })
  })

  describe('getConfidenceBadgeVariant', () => {
    it('returns correct badge variant for each level', () => {
      expect(getConfidenceBadgeVariant(0.9)).toBe('success')
      expect(getConfidenceBadgeVariant(0.7)).toBe('warning')
      expect(getConfidenceBadgeVariant(0.5)).toBe('destructive')
    })
  })

  describe('formatCalories', () => {
    it('formats calorie values correctly', () => {
      expect(formatCalories(450)).toBe('450 cal')
      expect(formatCalories(1234.5)).toBe('1235 cal')
    })

    it('handles null and undefined', () => {
      expect(formatCalories(null)).toBe('0 cal')
      expect(formatCalories(undefined)).toBe('0 cal')
    })
  })

  describe('calculateDailyTotal', () => {
    it('sums only today\'s logs', () => {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const logs = [
        { total_calories: 400, created_at: today.toISOString() },
        { total_calories: 600, created_at: today.toISOString() },
        { total_calories: 300, created_at: yesterday.toISOString() },
      ]

      expect(calculateDailyTotal(logs)).toBe(1000)
    })

    it('handles null calories', () => {
      const today = new Date()
      const logs = [
        { total_calories: 400, created_at: today.toISOString() },
        { total_calories: null, created_at: today.toISOString() },
      ]

      expect(calculateDailyTotal(logs)).toBe(400)
    })
  })

  describe('formatConfidencePercentage', () => {
    it('formats confidence as percentage', () => {
      expect(formatConfidencePercentage(0.85)).toBe('85%')
      expect(formatConfidencePercentage(0.5)).toBe('50%')
      expect(formatConfidencePercentage(1.0)).toBe('100%')
    })
  })
})
```

---

## Implementation Checklist

### Task 8.1.1: Mobile Navigation
- [ ] Create `src/components/app/mobile-navigation.tsx` with bottom tab bar
- [ ] Update `src/app/app/layout.tsx` to include mobile navigation
- [ ] Add `.safe-area-bottom` utility class to `src/app/globals.css`
- [ ] Create test file `src/components/app/__tests__/mobile-navigation.test.tsx`
- [ ] Run tests: `npm test mobile-navigation.test.tsx`
- [ ] Manual test: Open app on mobile device/simulator
- [ ] Verify navigation works on all screen sizes
- [ ] Verify active state highlights correctly
- [ ] Verify touch targets are 44px minimum

### Task 8.1.2: Deduplicate Profile Pages
- [ ] Create `src/lib/constants/profile.ts` with shared constants
- [ ] Create `src/components/profile/profile-form.tsx` with shared form component
- [ ] Update `src/app/app/profile/page.tsx` to use ProfileForm (reduce to ~30 lines)
- [ ] Decide on `src/app/profile/page.tsx` (remove or redirect)
- [ ] Create test file `src/components/profile/__tests__/profile-form.test.tsx`
- [ ] Create test file `src/lib/constants/__tests__/profile.test.ts`
- [ ] Run tests: `npm test profile-form.test.tsx`
- [ ] Run tests: `npm test profile.test.ts`
- [ ] Manual test: Update profile and verify data saves
- [ ] Verify all form fields work (checkboxes, selects, inputs)
- [ ] Verify success/error messages display correctly

### Task 8.1.3: Shared Nutrition Utilities
- [ ] Create `src/lib/nutrition-helpers.ts` with utility functions
- [ ] Update `src/components/calorie-tracker/FoodLogManager.tsx` to use helpers
- [ ] Update `src/components/calorie-tracker/meal-log.tsx` to use helpers
- [ ] Update `src/components/calorie-tracker/RecentMeals.tsx` to use helpers
- [ ] Update `src/components/calorie-tracker/AIAnalysisDisplay.tsx` to use helpers
- [ ] Create test file `src/lib/__tests__/nutrition-helpers.test.ts`
- [ ] Run tests: `npm test nutrition-helpers.test.ts`
- [ ] Manual test: Verify confidence badges display correctly
- [ ] Verify calorie formatting works throughout app
- [ ] Verify daily totals calculate correctly

### Final Verification
- [ ] Run full test suite: `npm test`
- [ ] Run linter: `npm run lint`
- [ ] Build production: `npm run build`
- [ ] Verify no console errors in browser
- [ ] Test on mobile device (iOS and Android if possible)
- [ ] Test navigation between all app sections
- [ ] Test profile updates
- [ ] Test meal logging with confidence scores
- [ ] Commit changes with descriptive message

---

## Files Created (9 new files)

1. `src/components/app/mobile-navigation.tsx`
2. `src/components/app/__tests__/mobile-navigation.test.tsx`
3. `src/lib/constants/profile.ts`
4. `src/components/profile/profile-form.tsx`
5. `src/components/profile/__tests__/profile-form.test.tsx`
6. `src/lib/constants/__tests__/profile.test.ts`
7. `src/lib/nutrition-helpers.ts`
8. `src/lib/__tests__/nutrition-helpers.test.ts`
9. `src/components/ui/status-alert.tsx` (if not exists - needed for ProfileForm)

## Files Modified (8 files)

1. `src/app/app/layout.tsx`
2. `src/app/globals.css`
3. `src/app/app/profile/page.tsx`
4. `src/components/calorie-tracker/FoodLogManager.tsx`
5. `src/components/calorie-tracker/meal-log.tsx`
6. `src/components/calorie-tracker/RecentMeals.tsx`
7. `src/components/calorie-tracker/AIAnalysisDisplay.tsx`
8. `src/app/profile/page.tsx` (optional)

## Files Removed (1 file - optional)

1. `src/app/profile/page.tsx` (if legacy location not needed)

---

## Time Estimate

- Task 8.1.1 (Mobile Navigation): 3-4 hours
- Task 8.1.2 (Deduplicate Profile): 6-8 hours
- Task 8.1.3 (Shared Utilities): 3-4 hours
- Testing & verification: 2-3 hours

**Total: 14-19 hours**

---

## Success Metrics

After completing Phase 8.1:
- Mobile navigation accessible on all devices
- Profile code reduced by 85% (from 1,361 to ~200 lines)
- Confidence score logic in 1 file (was in 4+)
- Test coverage increased by ~15 tests
- No regression in functionality
- Build completes successfully
- All tests passing