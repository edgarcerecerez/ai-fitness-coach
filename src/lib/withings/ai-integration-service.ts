import { createClient } from '@/utils/supabase/server';
import { apiLogger } from '@/lib/logger';
import {
  AIInsight,
  BiometricProfile,
  HealthGoal,
  HealthMetrics
} from './types';

export class WithingsAIIntegrationService {
  async generateBodyCompositionInsights(
    userId: string,
    metrics: HealthMetrics,
    profile: BiometricProfile
  ): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    const patternInsights = await this.generatePatternInsights(userId, metrics);
    const recommendationInsights = await this.generateRecommendationInsights(metrics, profile);
    const alertInsights = await this.generateAlertInsights(metrics);
    const achievementInsights = await this.generateAchievementInsights(userId, metrics);

    insights.push(
      ...patternInsights,
      ...recommendationInsights,
      ...alertInsights,
      ...achievementInsights
    );

    for (const insight of insights) {
      await this.storeInsight(userId, insight);
    }

    return insights;
  }

  private async generatePatternInsights(userId: string, metrics: HealthMetrics): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    const recentTrends = await this.getRecentTrends(userId);

    if (metrics.muscleFatRatio != null) {
      if (metrics.muscleFatRatio >= 1.2) {
        insights.push({
          type: 'pattern',
          category: 'body_composition',
          title: 'Strong Muscle-to-Fat Ratio',
          description: `Your muscle-to-fat ratio of ${metrics.muscleFatRatio} indicates well-balanced body composition.`,
          actionItems: [
            'Maintain consistent strength training 2-3 times per week',
            'Ensure adequate protein intake to preserve lean mass'
          ],
          confidenceScore: 0.85,
          importanceLevel: 'medium',
          triggerData: {
            muscleFatRatio: metrics.muscleFatRatio
          }
        });
      } else if (metrics.muscleFatRatio < 0.8) {
        insights.push({
          type: 'pattern',
          category: 'muscle_gain',
          title: 'Opportunity to Build Lean Mass',
          description: 'Your muscle-to-fat ratio suggests that a focus on lean mass development could improve body composition.',
          actionItems: [
            'Introduce progressive overload strength sessions',
            'Increase daily protein intake to 1.2-1.6g per kg of body weight'
          ],
          confidenceScore: 0.75,
          importanceLevel: 'medium',
          triggerData: {
            muscleFatRatio: metrics.muscleFatRatio
          }
        });
      }
    }

    const weightTrend = recentTrends.find(trend => trend.metricType === 'weight');
    if (weightTrend && weightTrend.trendDirection === 'down' && weightTrend.healthImpact === 'positive') {
      insights.push({
        type: 'achievement',
        category: 'progress',
        title: 'Consistent Progress Noted',
        description: 'Your weight trend has been steadily improving over the last period. Great job staying on track!',
        actionItems: ['Continue current nutrition and activity routines', 'Celebrate small milestones to maintain motivation'],
        confidenceScore: 0.8,
        importanceLevel: 'medium',
        triggerData: { recentTrend: weightTrend }
      });
    }

    return insights;
  }

  private async generateRecommendationInsights(
    metrics: HealthMetrics,
    profile: BiometricProfile
  ): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    if (metrics.bmi.health_risk === 'High' || metrics.bmi.health_risk === 'Extremely High') {
      insights.push({
        type: 'recommendation',
        category: 'weight_loss',
        title: 'Prioritize Weight Management Strategies',
        description: `Your BMI of ${metrics.bmi.value} is associated with higher health risk. A gradual and sustainable plan can help reduce risk.`,
        actionItems: [
          'Target a weekly weight loss of 0.5kg (1lb) through modest calorie deficit',
          'Increase daily activity by 20-30 minutes as tolerated',
          'Incorporate whole foods and minimize processed options'
        ],
        confidenceScore: 0.88,
        importanceLevel: 'high',
        triggerData: { bmi: metrics.bmi }
      });
    }

    if (metrics.metabolicAge && metrics.metabolicAge > profile.age + 5) {
      insights.push({
        type: 'recommendation',
        category: 'health_improvement',
        title: 'Focus on Metabolic Health Habits',
        description: `Your estimated metabolic age is ${metrics.metabolicAge}, which is above your chronological age. Lifestyle adjustments can improve metabolic efficiency.`,
        actionItems: [
          'Include interval training twice per week',
          'Prioritize sleep quality and stress management routines',
          'Distribute protein intake evenly across meals'
        ],
        confidenceScore: 0.72,
        importanceLevel: 'medium',
        triggerData: {
          metabolicAge: metrics.metabolicAge,
          chronologicalAge: profile.age
        }
      });
    }

    return insights;
  }

  private async generateAlertInsights(metrics: HealthMetrics): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    if (metrics.visceralFatLevel != null && metrics.visceralFatLevel > 12) {
      insights.push({
        type: 'alert',
        category: 'health_risk',
        title: 'Elevated Visceral Fat Level',
        description: 'Your visceral fat level is above the recommended range, which can increase health risks over time.',
        actionItems: [
          'Integrate moderate intensity cardio 150 minutes per week',
          'Prioritize fiber-rich foods and reduce added sugars',
          'Discuss metabolic screening with your healthcare provider'
        ],
        confidenceScore: 0.8,
        importanceLevel: 'critical',
        triggerData: {
          visceralFatLevel: metrics.visceralFatLevel
        }
      });
    }

    if (metrics.hydrationStatus && metrics.hydrationStatus.level === 'Dehydrated') {
      insights.push({
        type: 'alert',
        category: 'health_risk',
        title: 'Hydration Support Needed',
        description: metrics.hydrationStatus.recommendation ?? 'Increase daily hydration to reach optimal ranges.',
        actionItems: [
          'Set reminders to drink water throughout the day',
          'Include hydrating foods like fruits and vegetables',
          'Monitor hydration status using body water percentage readings'
        ],
        confidenceScore: 0.78,
        importanceLevel: 'high',
        triggerData: {
          hydrationStatus: metrics.hydrationStatus
        }
      });
    }

    return insights;
  }

  private async generateAchievementInsights(
    userId: string,
    metrics: HealthMetrics
  ): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    const goals = await this.getUserGoals(userId);

    for (const goal of goals) {
      if (!goal.is_active) {
        continue;
      }

      if (this.isGoalAchieved(goal, metrics)) {
        insights.push({
          type: 'achievement',
          category: 'progress',
          title: `Goal Achieved: ${goal.goal_type.replace(/_/g, ' ')}`,
          description: 'Great work! You have achieved your current Withings goal. Consider setting a new target to keep progressing.',
          actionItems: [
            'Record how you achieved this milestone for future reference',
            'Discuss maintenance strategies with your coach or healthcare provider'
          ],
          confidenceScore: 0.95,
          importanceLevel: 'high',
          triggerData: {
            goal,
            metrics
          }
        });
      }
    }

    return insights;
  }

  private async getRecentTrends(userId: string) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('withings_health_trends')
      .select('*')
      .eq('user_id', userId)
      .eq('trend_period', 'weekly')
      .order('analysis_date', { ascending: false })
      .limit(5);

    return data ?? [];
  }

  private async getUserGoals(userId: string): Promise<HealthGoal[]> {
    const supabase = await createClient();
    const { data } = await supabase
      .from('withings_health_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    return data ?? [];
  }

  private isGoalAchieved(goal: HealthGoal, metrics: HealthMetrics): boolean {
    switch (goal.metric_type) {
      case 'weight': {
        const currentWeight = metrics.weightKg ?? null;
        if (currentWeight == null) return false;
        return goal.goal_type === 'weight_loss'
          ? currentWeight <= goal.target_value
          : currentWeight >= goal.target_value;
      }
      case 'body_fat_percentage':
        return metrics.bodyFatPercentage != null && metrics.bodyFatPercentage <= goal.target_value;
      case 'muscle_mass_kg':
        return metrics.muscleMassKg != null && metrics.muscleMassKg >= goal.target_value;
      default:
        return false;
    }
  }

  private async storeInsight(userId: string, insight: AIInsight): Promise<void> {
    const supabase = await createClient();

    const since = new Date();
    since.setDate(since.getDate() - 1);

    const { data: existing } = await supabase
      .from('withings_ai_insights')
      .select('id')
      .eq('user_id', userId)
      .eq('title', insight.title)
      .gte('created_at', since.toISOString())
      .limit(1);

    if (existing && existing.length > 0) {
      return;
    }

    const { error } = await supabase.from('withings_ai_insights').insert({
      user_id: userId,
      insight_type: insight.type,
      category: insight.category,
      title: insight.title,
      description: insight.description,
      action_items: insight.actionItems ?? null,
      trigger_data: insight.triggerData,
      confidence_score: insight.confidenceScore,
      importance_level: insight.importanceLevel,
      expires_at: insight.expiresAt ? insight.expiresAt.toISOString() : null
    });

    if (error) {
      apiLogger.error('Failed to store AI insight', {
        userId,
        title: insight.title,
        error: error.message
      });
    }
  }
}
