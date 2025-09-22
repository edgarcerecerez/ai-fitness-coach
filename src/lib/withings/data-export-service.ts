import { Buffer } from 'node:buffer';
import { createClient } from '@/utils/supabase/server';
import { apiLogger } from '@/lib/logger';
import {
  ExportRequest,
  ExportFormat,
  ExportType
} from './types';

interface ExportPayload {
  weightLogs: unknown[];
  bodyComposition: unknown[];
  healthTrends: unknown[];
  insights: unknown[];
}

export class WithingsDataExportService {
  async initiateExport(userId: string, request: ExportRequest): Promise<string> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('withings_data_exports')
      .insert({
        user_id: userId,
        export_type: request.exportType,
        export_format: request.format,
        date_range_start: request.dateRange?.startDate.toISOString() ?? null,
        date_range_end: request.dateRange?.endDate.toISOString() ?? null,
        included_metrics: request.includedMetrics ?? null,
        status: 'processing'
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create export job: ${error?.message}`);
    }

    const exportId = data.id;

    try {
      const payload = await this.generateExportPayload(userId, request);
      const serialized = this.formatPayload(payload, request.format);
      const summary = this.createPayloadSummary(payload);

      const { error: updateError } = await supabase
        .from('withings_data_exports')
        .update({
          status: 'completed',
          file_size_bytes: Buffer.byteLength(serialized, 'utf-8'),
          completed_at: new Date().toISOString(),
          compliance_flags: {
            format: request.format,
            containsPHI: true,
            piiRedaction: 'not_required'
          },
          access_log: {
            events: [],
            summary
          },
          download_url: null
        })
        .eq('id', exportId);

      if (updateError) {
        throw updateError;
      }
    } catch (payloadError) {
      apiLogger.error('Withings export generation failed', {
        exportId,
        userId,
        error: payloadError instanceof Error ? payloadError.message : String(payloadError)
      });

      await supabase
        .from('withings_data_exports')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString()
        })
        .eq('id', exportId);
    }

    return exportId;
  }

  private async generateExportPayload(userId: string, request: ExportRequest): Promise<ExportPayload> {
    const supabase = await createClient();
    const filters = this.buildDateFilters(request.exportType, request.dateRange);

    const [weightLogs, bodyComposition, healthTrends, insights] = await Promise.all([
      this.fetchWeightLogs(supabase, userId, filters),
      this.fetchBodyComposition(supabase, userId, filters),
      this.fetchHealthTrends(supabase, userId, filters),
      this.fetchInsights(supabase, userId, filters)
    ]);

    return { weightLogs, bodyComposition, healthTrends, insights };
  }

  private formatPayload(payload: ExportPayload, format: ExportFormat): string {
    switch (format) {
      case 'json':
        return JSON.stringify(payload, null, 2);
      case 'csv':
      case 'pdf':
      default:
        // For now, provide JSON even for other formats and note via compliance flags
        return JSON.stringify({
          formatRequested: format,
          deliveredAs: 'json',
          payload
        }, null, 2);
    }
  }

  private createPayloadSummary(payload: ExportPayload) {
    return {
      weightLogCount: payload.weightLogs.length,
      compositionEntries: payload.bodyComposition.length,
      trendEntries: payload.healthTrends.length,
      insightCount: payload.insights.length,
      generatedAt: new Date().toISOString()
    };
  }

  private buildDateFilters(exportType: ExportType, dateRange?: ExportRequest['dateRange']) {
    if (exportType !== 'date_range' || !dateRange) {
      return {};
    }

    return {
      start: dateRange.startDate,
      end: dateRange.endDate
    };
  }

  private async fetchWeightLogs(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, filters: Record<string, Date | undefined>) {
    let query = supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', userId)
      .order('logged_at', { ascending: true });

    if (filters.start) {
      query = query.gte('logged_at', filters.start.toISOString());
    }
    if (filters.end) {
      query = query.lte('logged_at', filters.end.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch weight logs: ${error.message}`);
    }

    return data ?? [];
  }

  private async fetchBodyComposition(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, filters: Record<string, Date | undefined>) {
    let query = supabase
      .from('withings_body_composition_analysis')
      .select('*')
      .eq('user_id', userId)
      .order('analysis_date', { ascending: true });

    if (filters.start) {
      query = query.gte('analysis_date', filters.start.toISOString());
    }
    if (filters.end) {
      query = query.lte('analysis_date', filters.end.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch body composition analysis: ${error.message}`);
    }

    return data ?? [];
  }

  private async fetchHealthTrends(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, filters: Record<string, Date | undefined>) {
    let query = supabase
      .from('withings_health_trends')
      .select('*')
      .eq('user_id', userId)
      .order('analysis_date', { ascending: true });

    if (filters.start) {
      query = query.gte('analysis_date', filters.start.toISOString());
    }
    if (filters.end) {
      query = query.lte('analysis_date', filters.end.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch health trends: ${error.message}`);
    }

    return data ?? [];
  }

  private async fetchInsights(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, filters: Record<string, Date | undefined>) {
    let query = supabase
      .from('withings_ai_insights')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (filters.start) {
      query = query.gte('created_at', filters.start.toISOString());
    }
    if (filters.end) {
      query = query.lte('created_at', filters.end.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch AI insights: ${error.message}`);
    }

    return data ?? [];
  }
}
