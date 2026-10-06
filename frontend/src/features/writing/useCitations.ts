import { useQueries, useQueryClient } from '@tanstack/react-query'
import { previewCitation, type NewVersion } from '@/api/documents'
import { qk } from '@/api/queryKeys'
import type { EvidenceItem } from '@/api/schemas/evidence'
import type { CitePreview } from '@/api/schemas/writing'
import { extractCitations, kindToMode, type CitedEvidence } from './writingModel'

export interface CitationRow {
  cited: CitedEvidence
  /** The evidence in this project, or null when the text cites something that is not here. */
  evidence: EvidenceItem | null
  /** The formatted citation as the server builds it, or a plain fallback while it loads or if it fails. */
  formatted: string
  /** No locator is recorded, so the citation will say "page unknown": flagged, never guessed. */
  incompleteLocator: boolean
  loading: boolean
}

const fallbackText = (e: EvidenceItem) => [e.resource?.title ?? `EV-${e.id}`, e.locator].filter(Boolean).join(', ')

/**
 * The citations the text makes, with what each one points to. The formatted wording comes from the server's
 * citation preview (one query per cited evidence, cached).
 *
 * Only the locator is flagged as missing. The server's preview also reports the author and year as missing even when
 * they are known (request file C-18), so those flags are not shown.
 */
export function useCitationRows(projectId: number, documentId: number, text: string, evidence: readonly EvidenceItem[]): CitationRow[] {
  const cited = extractCitations(text)
  const byId = new Map(evidence.map((e) => [e.id, e]))

  const previews = useQueries({
    queries: cited.map((c) => ({
      queryKey: qk.project(projectId).documents.cite(c.id),
      queryFn: () => previewCitation(projectId, documentId, c.id, 'reference'),
      enabled: byId.has(c.id),
      staleTime: 5 * 60_000,
      retry: false,
    })),
  })

  return cited.map((c, i) => {
    const e = byId.get(c.id) ?? null
    const preview = previews[i]
    return {
      cited: c,
      evidence: e,
      formatted: preview?.data?.formatted_citation ?? (e ? fallbackText(e) : c.code),
      incompleteLocator: e ? !e.locator?.trim() : false,
      loading: !!e && !!preview?.isPending && preview.fetchStatus !== 'idle',
    }
  })
}

/**
 * The citations to store with a version of some text: one per way each cited evidence is cited. The wording is read
 * from the cache at the moment of saving, so saving never waits for a preview.
 */
export function useCitationPayload(projectId: number, evidence: readonly EvidenceItem[]) {
  const qc = useQueryClient()
  const byId = new Map(evidence.map((e) => [e.id, e]))
  return (body: string): NewVersion['citations'] =>
    extractCitations(body).flatMap((c) => {
      const e = byId.get(c.id)
      if (!e) return []
      const cached = qc.getQueryData<CitePreview>(qk.project(projectId).documents.cite(c.id))
      return c.kinds.map((kind) => ({
        resource_id: e.resource_id,
        evidence_id: e.id,
        locator: e.locator ?? undefined,
        citation_type: kindToMode(kind),
        formatted_citation: cached?.formatted_citation ?? fallbackText(e),
      }))
    })
}
