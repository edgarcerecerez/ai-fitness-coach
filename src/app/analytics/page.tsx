import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard"

export const metadata = {
  title: "Analytics — AI Fitness Coach",
  description:
    "Explore correlations across your weight, nutrition, and mood logs, export your data, and manage family sharing.",
}

export default function AnalyticsPage() {
  return (
    <main className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <AnalyticsDashboard />
    </main>
  )
}
