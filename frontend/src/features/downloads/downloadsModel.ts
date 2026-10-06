import { asExportState, type ExportJob, type ExportPart, type ExportState } from '@/api/schemas/exports'
import { formatCode } from '@/domain/codes'

export const exportCode = (id: number) => formatCode('EXP', id)

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const
export type ByteUnit = (typeof UNITS)[number]

/** 1536 -> { value: 1.5, unit: 'KB' }. One decimal below 10, none above, so "2.1 GB" and "640 MB" read naturally. */
export function splitBytes(bytes: number): { value: number; unit: ByteUnit } {
  let value = Math.max(0, bytes)
  let i = 0
  while (value >= 1024 && i < UNITS.length - 1) {
    value /= 1024
    i++
  }
  const rounded = value < 10 && i > 0 ? Math.round(value * 10) / 10 : Math.round(value)
  return { value: rounded, unit: UNITS[i]! }
}

export const isActive = (job: Pick<ExportJob, 'status'>): boolean =>
  job.status === 'queued' || job.status === 'running'

const readyPart = (p: ExportPart) => p.status === 'ready' || p.status === 'ok'

export const partsOf = (job: ExportJob): ExportPart[] => job.parts ?? []

/**
 * The state shown to the researcher. `partial` is worked out from the parts (some ready, some not), and a finished
 * package past its expiry date shows as expired whatever the API still says.
 */
export function jobState(job: ExportJob, now: number): ExportState | 'unknown' {
  const base = asExportState(job.status)
  if (base === 'complete') {
    if (job.expires_at && Date.parse(job.expires_at) < now) return 'expired'
    const parts = partsOf(job)
    if (parts.length > 1 && parts.some((p) => !readyPart(p)) && parts.some(readyPart)) return 'partial'
  }
  return base
}

export const partIsReady = readyPart
export const partIsBlocked = (p: ExportPart) => p.status === 'blocked'

export const partSize = (p: ExportPart): number | null => p.size_bytes ?? p.size ?? null
export const partChecksum = (p: ExportPart): string | null => p.checksum_sha256 ?? p.checksum ?? null
export const partId = (p: ExportPart, index: number): number => p.id ?? p.part_number ?? index + 1

export function daysUntil(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null
  return Math.ceil((Date.parse(iso) - now) / 86_400_000)
}
