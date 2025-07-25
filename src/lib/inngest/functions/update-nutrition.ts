import { getInngestClient } from '@/lib/inngest/client';
import { createClient } from '@/utils/supabase/server';
import logger from '@/lib/logger';

export const updateNutritionData = getInngestClient().createFunction(
  { id: 'update-nutrition-data' },
  { event: 'nutrition/analysis.completed' },
  async ({ event, step }) => {
    const { logId, userId, confidenceScore } = event.data;

    // Update user's daily nutrition summary
    await step.run('update-daily-summary', async () => {
      const supabase = await createClient();
      
      // Get today's date in local timezone
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      
      // Calculate daily totals using timezone-aware boundaries
      const { data: todayLogs, error: fetchError } = await supabase
        .from('nutrition_logs')
        .select('total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g')
        .eq('user_id', userId)
        .gte('created_at', startOfDay.toISOString())
        .lt('created_at', endOfDay.toISOString());

      if (fetchError) {
        logger.error('Failed to fetch daily nutrition logs', { error: fetchError, userId });
        throw fetchError;
      }

      const dailyTotals = todayLogs.reduce((acc, log) => ({
        calories: acc.calories + (log.total_calories || 0),
        protein: acc.protein + (log.total_protein_g || 0),
        carbs: acc.carbs + (log.total_carbs_g || 0),
        fat: acc.fat + (log.total_fat_g || 0),
        fiber: acc.fiber + (log.total_fiber_g || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

      logger.info('Daily nutrition summary updated', {
        userId,
        date: startOfDay.toISOString().split('T')[0],
        dailyTotals
      });

      return dailyTotals;
    });

    // Check if user should receive insights
    await step.run('check-insights-trigger', async () => {
      if (confidenceScore < 0.7) {
        await step.sendEvent('low-confidence-alert', {
          name: 'nutrition/low-confidence',
          data: {
            logId,
            userId,
            confidenceScore,
          },
        });
      }
    });

    return { success: true };
  }
); 