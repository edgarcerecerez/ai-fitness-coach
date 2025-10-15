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
export type FitnessGoal = 'Lose weight' | 'Gain muscle' | 'Maintain weight' | 'Improve endurance' | 'Improve flexibility' | 'General health' | 'Better sleep' | 'Stress management'
export type DietaryPreference = 'none' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'gluten_free' | 'dairy_free'