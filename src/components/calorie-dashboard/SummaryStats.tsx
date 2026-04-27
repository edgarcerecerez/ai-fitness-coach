import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NutritionTotals } from '@/lib/calorie-aggregations'
import { formatNumber } from './format-helpers'

interface SummaryStatsProps {
  label: string
  totals: NutritionTotals
}

interface Stat {
  label: string
  value: string
  unit?: string
}

export default function SummaryStats({ label, totals }: SummaryStatsProps) {
  const stats: Stat[] = [
    { label: 'Calories', value: formatNumber(totals.calories), unit: 'kcal' },
    { label: 'Protein', value: formatNumber(totals.protein_g, 1), unit: 'g' },
    { label: 'Carbs', value: formatNumber(totals.carbs_g, 1), unit: 'g' },
    { label: 'Fat', value: formatNumber(totals.fat_g, 1), unit: 'g' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border bg-card p-4 text-center"
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {stat.value}
                {stat.unit ? (
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    {stat.unit}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
