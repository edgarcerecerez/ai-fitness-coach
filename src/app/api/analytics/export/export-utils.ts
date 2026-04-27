import PDFDocument from 'pdfkit'
import JSZip from 'jszip'

export type ExportFormat = 'json' | 'csv' | 'pdf'

export interface WeightLog {
  id?: string
  recorded_at: string
  weight_kg?: number | string | null
  body_fat_percentage?: number | string | null
  muscle_mass_kg?: number | string | null
  source?: string | null
}

export interface NutritionLog {
  id?: string
  recorded_at: string
  total_calories?: number | string | null
  total_protein_g?: number | string | null
  total_carbs_g?: number | string | null
  total_fat_g?: number | string | null
  total_fiber_g?: number | string | null
  notes?: string | null
}

export interface MoodLog {
  id?: string
  recorded_at: string
  mood_score?: number | string | null
  energy_level?: number | string | null
  stress_level?: number | string | null
  sleep_quality?: number | string | null
  notes?: string | null
}

export interface HealthExportPayload {
  generated_at: string
  user_id: string
  range: { start: string | null; end: string | null }
  weight_logs: WeightLog[]
  nutrition_logs: NutritionLog[]
  mood_logs: MoodLog[]
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

function rowsToCsv<T extends object>(rows: T[], columns: (keyof T & string)[]): string {
  const header = columns.join(',')
  if (rows.length === 0) return header + '\n'
  const lines = rows.map((row) =>
    columns.map((c) => csvCell((row as Record<string, unknown>)[c])).join(',')
  )
  return [header, ...lines].join('\n') + '\n'
}

const WEIGHT_COLUMNS: (keyof WeightLog & string)[] = [
  'id',
  'recorded_at',
  'weight_kg',
  'body_fat_percentage',
  'muscle_mass_kg',
  'source',
]

const NUTRITION_COLUMNS: (keyof NutritionLog & string)[] = [
  'id',
  'recorded_at',
  'total_calories',
  'total_protein_g',
  'total_carbs_g',
  'total_fat_g',
  'total_fiber_g',
  'notes',
]

const MOOD_COLUMNS: (keyof MoodLog & string)[] = [
  'id',
  'recorded_at',
  'mood_score',
  'energy_level',
  'stress_level',
  'sleep_quality',
  'notes',
]

/**
 * Builds a ZIP archive containing one CSV per dataset plus a README. Standard
 * CSV tools cannot parse a single concatenated file with multiple headers, so
 * we ship the three tables as separate files.
 */
async function buildCsvZip(payload: HealthExportPayload): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('weight_logs.csv', rowsToCsv(payload.weight_logs, WEIGHT_COLUMNS))
  zip.file('nutrition_logs.csv', rowsToCsv(payload.nutrition_logs, NUTRITION_COLUMNS))
  zip.file('mood_logs.csv', rowsToCsv(payload.mood_logs, MOOD_COLUMNS))
  zip.file(
    'README.txt',
    [
      `Health export generated at ${payload.generated_at}`,
      `Range: ${payload.range.start ?? 'beginning'} to ${payload.range.end ?? 'now'}`,
      '',
      'Files:',
      '  weight_logs.csv',
      '  nutrition_logs.csv',
      '  mood_logs.csv',
      '',
    ].join('\n')
  )
  return zip.generateAsync({ type: 'nodebuffer' })
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

      const renderSection = <T,>(
        title: string,
        rows: T[],
        format: (row: T) => string
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

      renderSection<WeightLog>(
        `Weight logs (${payload.weight_logs.length})`,
        payload.weight_logs,
        (r) =>
          `${r.recorded_at} — ${r.weight_kg} kg${
            r.body_fat_percentage ? ` · ${r.body_fat_percentage}% bf` : ''
          }${r.source ? ` · ${r.source}` : ''}`
      )

      renderSection<NutritionLog>(
        `Nutrition logs (${payload.nutrition_logs.length})`,
        payload.nutrition_logs,
        (r) =>
          `${r.recorded_at} — ${r.total_calories ?? 0} kcal · P${r.total_protein_g ?? 0}g · C${
            r.total_carbs_g ?? 0
          }g · F${r.total_fat_g ?? 0}g`
      )

      renderSection<MoodLog>(
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
 * Note: the `csv` format returns a ZIP archive containing one CSV per dataset
 * because standard CSV tools cannot parse a single file with multiple tables.
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
    const zip = await buildCsvZip(payload)
    return {
      body: zip,
      contentType: 'application/zip',
      filename: `health-export-${slug}.zip`,
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
