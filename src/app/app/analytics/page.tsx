
import { BodyCompositionChart } from '@/components/analytics/body-composition-chart';
import { HealthTrendsDashboard } from '@/components/analytics/health-trends-dashboard';
import { AIInsightsPanel } from '@/components/analytics/ai-insights-panel';
import { DataExportModal } from '@/components/export/data-export-modal';

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Health Analytics</h1>
      <div className="flex justify-end mb-4">
        <DataExportModal />
      </div>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Body Composition</h2>
          <BodyCompositionChart />
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-4">Health Trends</h2>
          <HealthTrendsDashboard />
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-4">AI Insights</h2>
          <AIInsightsPanel />
        </div>
      </div>
    </div>
  );
}
