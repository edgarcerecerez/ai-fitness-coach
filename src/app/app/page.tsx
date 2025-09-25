import React from 'react'
import { createClient } from '@/utils/supabase/server'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { 
  WeightProgressChart, 
  CalorieIntakeChart, 
  MoodSleepChart 
} from '@/components/dashboard-preview'
import { Camera, Calendar } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type NutritionLog = {
  readonly id: string
  readonly created_at: string
  readonly total_calories: number | null
  readonly food_items?: unknown
  readonly image_url?: string | null
  readonly confidence_score?: number | null
}

const calculateTodaysCalories = (logs: readonly NutritionLog[]): number => {
  if (logs.length === 0) {
    return 0
  }

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

export default async function AppDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const userId = user.id

  // Fetch user profile and recent data
  const [profileResult, recentNutritionResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single(),
    supabase
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)
  ])

  const profile = profileResult.data
  const recentNutrition = (recentNutritionResult.data || []) as NutritionLog[]
  const todaysCalories = calculateTodaysCalories(recentNutrition)

  return (
    <div className="min-h-screen relative">
      {/* Main Content */}
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-card-foreground">
                Welcome back, {profile?.full_name || user?.email}!
              </h1>
              <p className="text-muted-foreground mt-2">
                Track your health journey with AI-powered insights
              </p>
            </div>
            <Button
              className="glass-button"
              asChild
            >
              <Link href="/app/calorie-tracker">
                <Camera className="w-4 h-4 mr-2" />
                Log Meal
              </Link>
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-6">
              <div className="pb-3">
                <h3 className="text-sm font-medium text-card-foreground">Today&apos;s Calories</h3>
              </div>
              <div>
                <div className="text-2xl font-bold text-card-foreground">
                  {todaysCalories}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {recentNutrition.length} meals logged
                </p>
              </div>
            </div>

            <div className="glass-panel p-6">
              <div className="pb-3">
                <h3 className="text-sm font-medium text-card-foreground">Current Weight</h3>
              </div>
              <div>
                <div className="text-2xl font-bold text-card-foreground">
                  {profile?.weight_kg ? `${profile.weight_kg} kg` : 'Not set'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Target: {profile?.weight_kg ? `${profile.weight_kg - 5} kg` : 'Set target'}
                </p>
              </div>
            </div>

            <div className="glass-panel p-6">
              <div className="pb-3">
                <h3 className="text-sm font-medium text-card-foreground">Fitness Goals</h3>
              </div>
              <div>
                <div className="flex flex-wrap gap-1">
                  {profile?.fitness_goals && profile.fitness_goals.length > 0 ? (
                    profile.fitness_goals.slice(0, 2).map((goal: string) => (
                      <Badge key={goal} variant="outline" className="text-xs text-card-foreground border-primary/30">
                        {goal}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">None set</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-panel p-6">
              <WeightProgressChart />
            </div>
            <div className="space-y-6">
              <div className="glass-panel p-6">
                <CalorieIntakeChart />
              </div>
              <div className="glass-panel p-6">
                <MoodSleepChart />
              </div>
            </div>
          </div>

          {/* Recent Meals */}
          <div className="glass-panel p-6">
            <div className="mb-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground mb-2">
                <Calendar className="w-5 h-5 text-primary" />
                Recent Meals
              </h2>
              <p className="text-muted-foreground">
                Your latest food logging activity
              </p>
            </div>
            <div>
              {recentNutrition.length > 0 ? (
                <div className="space-y-4">
                  {recentNutrition.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-secondary/20">
                      <div className="flex items-center space-x-3">
                        {log.image_url && (
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden">
                            <Image
                              src={log.image_url}
                              alt="Meal"
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-card-foreground">
                            {log.food_items ?
                              typeof log.food_items === 'string' ?
                                log.food_items :
                                JSON.stringify(log.food_items)
                              : 'Meal'
                            }
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(log.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-card-foreground">{log.total_calories || 0} cal</p>
                        {log.confidence_score && (
                          <p className="text-xs text-muted-foreground">
                            {Math.round(log.confidence_score * 100)}% confident
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Camera className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No meals logged yet</p>
                  <Button className="glass-button" asChild>
                    <Link href="/app/calorie-tracker">
                      Log Your First Meal
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
