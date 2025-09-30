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
  readonly id: string
  readonly full_name: string | null
  readonly age: number | null
  readonly gender: GenderOption | null
  readonly height_cm: number | null
  readonly weight_kg: number | null
  readonly activity_level: ActivityLevel | null
  readonly fitness_goals: readonly FitnessGoal[]
  readonly dietary_preferences: readonly DietaryPreference[]
  readonly target_daily_calories: number | null
}

interface ProfileFormProps {
  readonly user: User
  readonly initialProfile?: UserProfile | null
  readonly onSuccess?: () => void
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
    } catch (unknownErr: unknown) {
      console.error('Error updating profile:', unknownErr)
      const errorMessage = unknownErr instanceof Error ? unknownErr.message : 'Failed to update profile'
      setMessage({
        type: 'error',
        text: errorMessage
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