import PDFDocument from 'pdfkit'

export type ExportFormat = 'json' | 'csv' | 'pdf'

export interface HealthExportPayload {
  generated_at: string
  user_id: string
  range: { start: string | null; end: string | null }
  weight_logs: Record<string, unknown>[]
  nutrition_logs: Record<string, unknown>[]
  mood_logs: Record<string, unknown>[]
}

export interface BuiltExport {
  body: Buffer | string
  contentType: string
  filename: string
}

const TIMESTAMP_RE = /[:.]/g

function timestampSlug(): string {
  return new Date().toISOString().replace(TIMESTAMP_RE, '-')
}

/**
 * Escapes a single value for inclusion in CSV output. Always wraps in quotes
 * and doubles any internal quotes so commas/newlines in notes are safe.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""'
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return `"${str.replace(/"/g, '""')}"`
}

function rowsToCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(',')
  if (rows.length === 0) return header + '\n'
  const lines = rows.map((row) => columns.map((c) => csvCell(row[c])).join(','))
  return [header, ...lines].join('\n') + '\n'
}

function buildCsv(payload: HealthExportPayload): string {
  const sections = [
    `# Health export generated at ${payload.generated_at}`,
    `# Range: ${payload.range.start ?? 'beginning'} to ${payload.range.end ?? 'now'}`,
    '',
    '## weight_logs',
    rowsToCsv(payload.weight_logs, [
      'id',
      'recorded_at',
      'weight_kg',
      'body_fat_percentage',
      'muscle_mass_kg',
      'source',
    ]),
    '## nutrition_logs',
    rowsToCsv(payload.nutrition_logs, [
      'id',
      'recorded_at',
      'total_calories',
      'total_protein_g',
      'total_carbs_g',
      'total_fat_g',
      'total_fiber_g',
      'notes',
    ]),
    '## mood_logs',
    rowsToCsv(payload.mood_logs, [
      'id',
      'recorded_at',
      'mood_score',
      'energy_level',
      'stress_level',
      'sleep_quality',
      'notes',
    ]),
  ]
  return sections.join('\n')
}

function buildPdf(payload: HealthExportPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', margin: 48 })
      const chunks: Buffer[] = []
      doc.on('data', (chunk) => chunks.push(chunk as Buffer))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      doc.fontSize(20).text('AI Fitness Coach — Health Data Export', { align: 'left' })
      doc.moveDown(0.5)
      doc.fontSize(10).fillColor('#555')
      doc.text(`Generated: ${payload.generated_at}`)
      doc.text(
        `Range: ${payload.range.start ?? 'beginning'} to ${payload.range.end ?? 'now'}`
      )
      doc.fillColor('#000')

      const renderSection = (
        title: string,
        rows: Record<string, unknown>[],
        format: (row: Record<string, unknown>) => string
      ) => {
        doc.moveDown(1)
        doc.fontSize(14).text(title)
        doc.moveDown(0.25)
        doc.fontSize(10)
        if (rows.length === 0) {
          doc.fillColor('#888').text('No entries in this range.').fillColor('#000')
          return
        }
        for (const row of rows) {
          doc.text(format(row))
        }
      }

      renderSection(
        `Weight logs (${payload.weight_logs.length})`,
        payload.weight_logs,
        (r) =>
          `${r.recorded_at} — ${r.weight_kg} kg${
            r.body_fat_percentage ? ` · ${r.body_fat_percentage}% bf` : ''
          }${r.source ? ` · ${r.source}` : ''}`
      )

      renderSection(
        `Nutrition logs (${payload.nutrition_logs.length})`,
        payload.nutrition_logs,
        (r) =>
          `${r.recorded_at} — ${r.total_calories ?? 0} kcal · P${r.total_protein_g ?? 0}g · C${
            r.total_carbs_g ?? 0
          }g · F${r.total_fat_g ?? 0}g`
      )

      renderSection(
        `Mood logs (${payload.mood_logs.length})`,
        payload.mood_logs,
        (r) =>
          `${r.recorded_at} — mood ${r.mood_score ?? '-'}/10 · energy ${
            r.energy_level ?? '-'
          }/10 · stress ${r.stress_level ?? '-'}/10 · sleep ${r.sleep_quality ?? '-'}/10`
      )

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Builds the export body, content type, and filename for the given format.
 */
export async function buildHealthExport(
  payload: HealthExportPayload,
  format: ExportFormat
): Promise<BuiltExport> {
  const slug = timestampSlug()
  if (format === 'json') {
    return {
      body: JSON.stringify(payload, null, 2),
      contentType: 'application/json',
      filename: `health-export-${slug}.json`,
    }
  }
  if (format === 'csv') {
    return {
      body: buildCsv(payload),
      contentType: 'text/csv; charset=utf-8',
      filename: `health-export-${slug}.csv`,
    }
  }
  // pdf
  const pdf = await buildPdf(payload)
  return {
    body: pdf,
    contentType: 'application/pdf',
    filename: `health-export-${slug}.pdf`,
  }
}
