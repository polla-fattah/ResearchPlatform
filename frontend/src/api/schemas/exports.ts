import { z } from 'zod'

/** Export job states from the design (screen 12). */
export const EXPORT_STATES = [
  'queued',
  'running',
  'complete',
  'partial',
  'failed',
  'cancelled',
  'expired',
] as const
export type ExportState = (typeof EXPORT_STATES)[number]

export function asExportState(value: string): ExportState | 'unknown' {
  const v = value === 'completed' ? 'complete' : value // older rows say "completed"
  return (EXPORT_STATES as readonly string[]).includes(v) ? (v as ExportState) : 'unknown'
}

/**
 * Only the fields the UI needs. The backend's export packaging is a stub today (request file C-7):
 * jobs stay `queued`, and `parts`, `progress` and checksums are not real. The UI never presents
 * them as finished work.
 */
export const exportJobSchema = z.object({
  id: z.number(),
  scope: z.string(),
  target_id: z.number().nullable().optional(),
  format: z.string().nullable().optional(),
  status: z.string(),
  progress: z.string().nullable().optional(),
  file_size: z.number().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  failure_reason: z.string().nullable().optional(),
})
export type ExportJob = z.infer<typeof exportJobSchema>
