import { z } from 'zod'

/** Export job states from the design (screen 12). `partial` is derived from the parts, never sent. */
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
  const v = value === 'completed' ? 'complete' : value // the API says "completed"
  return (EXPORT_STATES as readonly string[]).includes(v) ? (v as ExportState) : 'unknown'
}

export const exportPartSchema = z.object({
  id: z.number().optional(),
  part_number: z.number().optional(),
  name: z.string(),
  size: z.number().nullable().optional(),
  size_bytes: z.number().nullable().optional(),
  checksum: z.string().nullable().optional(),
  checksum_sha256: z.string().nullable().optional(),
  /** ready | failed | blocked | waiting */
  status: z.string(),
})
export type ExportPart = z.infer<typeof exportPartSchema>

/** What the manifest says today is small (request file C-17); the optional fields are used when they arrive. */
export const exportManifestSchema = z.object({
  job_id: z.number(),
  scope: z.string(),
  format: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  requester: z
    .object({ id: z.number().optional(), display_name: z.string().optional() })
    .nullable()
    .optional(),
  files: z.array(z.string()).optional(),
  corpus_version: z.string().nullable().optional(),
  counts: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  checksums: z.record(z.string(), z.string()).optional(),
  exclusions: z
    .array(z.object({ kind: z.string(), what: z.string(), why: z.string() }))
    .optional(),
})
export type ExportManifest = z.infer<typeof exportManifestSchema>

export const exportJobSchema = z.object({
  id: z.number(),
  scope: z.string(),
  target_id: z.number().nullable().optional(),
  format: z.string().nullable().optional(),
  /** queued | running | completed | failed | cancelled */
  status: z.string(),
  progress: z.string().nullable().optional(),
  file_size: z.number().nullable().optional(),
  checksum: z.string().nullable().optional(),
  download_url: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  failure_reason: z.string().nullable().optional(),
  parts: z.array(exportPartSchema).nullable().optional(),
})
export type ExportJob = z.infer<typeof exportJobSchema>

export const exportQuotaSchema = z.object({
  used_bytes: z.number(),
  limit_bytes: z.number(),
  concurrent_jobs: z.number(),
  concurrent_limit: z.number(),
})
export type ExportQuota = z.infer<typeof exportQuotaSchema>

export const exportPreviewSchema = z.object({
  counts: z.record(z.string(), z.number()),
  estimated_size_bytes: z.number(),
  exclusions: z.array(z.unknown()).optional(),
})
export type ExportPreview = z.infer<typeof exportPreviewSchema>
