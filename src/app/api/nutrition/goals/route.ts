import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'super_active';
type WeightGoal = 'lose' | 'maintain' | 'gain';

interface ValidatedGoals {
  readonly daily_calorie_goal: number;
  readonly daily_protein_goal_g: number;
  readonly daily_carbs_goal_g: number;
  readonly daily_fat_goal_g: number;
  readonly daily_fiber_goal_g: number;
  readonly activity_level?: ActivityLevel;
  readonly weight_goal?: WeightGoal;
}

function validateGoalsRequest(body: unknown): { data?: ValidatedGoals; error?: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid request body' };
  }
  const {
    daily_calorie_goal,
    daily_protein_goal_g,
    daily_carbs_goal_g,
    daily_fat_goal_g,
    daily_fiber_goal_g,
    activity_level,
    weight_goal,
  } = body as Record<string, unknown>;

  const numericFields: Array<{ name: keyof ValidatedGoals; value: unknown }> = [
    { name: 'daily_calorie_goal', value: daily_calorie_goal },
    { name: 'daily_protein_goal_g', value: daily_protein_goal_g },
    { name: 'daily_carbs_goal_g', value: daily_carbs_goal_g },
    { name: 'daily_fat_goal_g', value: daily_fat_goal_g },
    { name: 'daily_fiber_goal_g', value: daily_fiber_goal_g },
  ];

  for (const field of numericFields) {
    if (field.value === undefined || field.value === null) {
      return { error: `Missing required field: ${String(field.name)}` };
    }
    if (typeof field.value !== 'number' || field.value < 0 || !Number.isFinite(field.value)) {
      return { error: `${String(field.name)} must be a positive number` };
    }
  }

  const validActivityLevels: readonly ActivityLevel[] = ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'super_active'];
  if (activity_level !== undefined) {
    if (typeof activity_level !== 'string' || !validActivityLevels.includes(activity_level as ActivityLevel)) {
      return { error: 'Invalid activity_level. Must be one of: ' + validActivityLevels.join(', ') };
    }
  }

  const validWeightGoals: readonly WeightGoal[] = ['lose', 'maintain', 'gain'];
  if (weight_goal !== undefined) {
    if (typeof weight_goal !== 'string' || !validWeightGoals.includes(weight_goal as WeightGoal)) {
      return { error: 'Invalid weight_goal. Must be one of: ' + validWeightGoals.join(', ') };
    }
  }

  return {
    data: {
      daily_calorie_goal: daily_calorie_goal as number,
      daily_protein_goal_g: daily_protein_goal_g as number,
      daily_carbs_goal_g: daily_carbs_goal_g as number,
      daily_fat_goal_g: daily_fat_goal_g as number,
      daily_fiber_goal_g: daily_fiber_goal_g as number,
      activity_level: activity_level as ActivityLevel | undefined,
      weight_goal: weight_goal as WeightGoal | undefined,
    }
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: goals, error } = await supabase
      .from('user_nutrition_goals')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return NextResponse.json({ goals });

  } catch (error: unknown) {
    console.error('Get goals API error:', error instanceof Error ? { message: error.message, stack: error.stack } : String(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { data: validated, error: validationError } = validateGoalsRequest(body);
    if (validationError || !validated) {
      return NextResponse.json({ error: validationError || 'Invalid request' }, { status: 400 });
    }

    const { data: goals, error } = await supabase
      .from('user_nutrition_goals')
      .upsert({
        user_id: user.id,
        daily_calorie_goal: validated.daily_calorie_goal,
        daily_protein_goal_g: validated.daily_protein_goal_g,
        daily_carbs_goal_g: validated.daily_carbs_goal_g,
        daily_fat_goal_g: validated.daily_fat_goal_g,
        daily_fiber_goal_g: validated.daily_fiber_goal_g,
        activity_level: validated.activity_level,
        weight_goal: validated.weight_goal,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ goals });

  } catch (error: unknown) {
    console.error('Update goals API error:', error instanceof Error ? { message: error.message, stack: error.stack } : String(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 