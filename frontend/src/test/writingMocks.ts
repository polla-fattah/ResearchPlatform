import { http, HttpResponse } from 'msw'
import { envelope } from './helpers'
import { mockProjectApis, projectDetail } from './projectMocks'
import { server } from './server'

/** The API embeds whole users (e-mail, roles, profile); the mocks do too, to show the screen ignores them. */
export const person = (over: Record<string, unknown> = {}) => ({
  id: 1,
  display_name: 'Shilan Rashid',
  email: 'shilan@example.org',
  is_admin: false,
  roles: ['researcher'],
  profile: { affiliation: 'SUE' },
  ...over,
})

export const version = (n: number, content: string, over: Record<string, unknown> = {}) => ({
  id: 100 + n,
  document_id: 31,
  version_number: n,
  content,
  change_summary: null,
  created_at: '2026-10-05T10:00:00Z',
  author: person(),
  citations: [],
  ...over,
})

export const documentItem = (over: Record<string, unknown> = {}) => ({
  id: 31,
  project_id: 12,
  title: 'Chains of the wuḍūʾ reports',
  document_type: 'article',
  language: 'ar',
  lock_version: 1,
  locked_by: null,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-05T10:00:00Z',
  latest_version: version(2, '# Wuḍūʾ\n\nأَنَّ النَّبِيَّ تَوَضَّأَ ثَلاَثًا'),
  findings: [],
  ...over,
})

export const evidenceItem = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  project_id: 12,
  resource_id: 70 + id,
  captured_text: 'تَوَضَّأَ ثَلاَثًا ثَلاَثًا',
  locator: 'Vol. 1, p. 78',
  state: 'included',
  resource: { id: 70 + id, resource_type: 'external', title: 'Sunan Abī Dāwūd, 106' },
  collector: person(),
  ...over,
})

export const findingItem = (over: Record<string, unknown> = {}) => ({
  id: 4,
  project_id: 12,
  question: 'Do the Kufan chains share a common link?',
  claim: 'The three-times wording is the shortest form.',
  reasoning: 'Eleven of fourteen occurrences carry only that wording.',
  limitations: null,
  status: 'provisional',
  version: 1,
  contributors: null,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-04T10:00:00Z',
  evidence_items: [
    { ...evidenceItem(4), pivot: { relation_type: 'supporting', interpretation: 'Shortest form.' } },
    { ...evidenceItem(7, { captured_text: 'مَرَّةً مَرَّةً' }), pivot: { relation_type: 'opposing', interpretation: null } },
  ],
  documents: [{ id: 31, title: 'Chains of the wuḍūʾ reports', document_type: 'article' }],
  ...over,
})

const pg = (n: number) => ({ pagination: { current_page: 1, per_page: 100, total_items: n, total_pages: 1, has_more: false } })
const failure = (status: number, code: string, message: string, details: unknown = []) =>
  HttpResponse.json({ success: false, error: { code, message, details } }, { status })

export interface WritingApis {
  role?: string
  documents?: Record<string, unknown>[]
  findings?: Record<string, unknown>[]
  evidence?: Record<string, unknown>[]
  /** The document's versions, oldest first. Saves append to it. */
  versions?: ReturnType<typeof version>[]
  draft?: Record<string, unknown>
  /** Overrides, each returning a Response to take over or undefined to use the default behaviour. */
  putDraft?: (body: Record<string, unknown>) => Response | undefined
  postVersion?: (body: Record<string, unknown>) => Response | undefined
  lock?: () => Response | undefined
  getFinding?: (call: number) => Response | undefined
  patchFinding?: (body: Record<string, unknown>) => Response | undefined
}

/** Handlers for everything screen 11 uses, with recorders for what was sent. */
export function mockWriting(o: WritingApis = {}) {
  const calls = {
    drafts: [] as Record<string, unknown>[],
    versions: [] as Record<string, unknown>[],
    restores: [] as string[],
    locks: 0,
    unlocks: 0,
    createdDocs: [] as Record<string, unknown>[],
    patchedDocs: [] as Record<string, unknown>[],
    deletedDocs: [] as string[],
    docLinks: [] as string[],
    docUnlinks: [] as string[],
    createdFindings: [] as Record<string, unknown>[],
    patchedFindings: [] as Record<string, unknown>[],
    deletedFindings: [] as string[],
    evidenceLinks: [] as Record<string, unknown>[],
    evidenceUnlinks: [] as string[],
    findingGets: 0,
  }
  mockProjectApis(12, {
    detail: projectDetail({
      memberships: [{ user_id: 1, role: o.role ?? 'owner', status: 'accepted', user: { id: 1, display_name: 'Shilan Rashid' } }],
      ...(o.role && o.role !== 'owner' ? { owner_id: 2 } : {}),
    }),
  })
  const versions = o.versions ?? [version(1, '# Wuḍūʾ\n\nfirst'), version(2, '# Wuḍūʾ\n\nأَنَّ النَّبِيَّ تَوَضَّأَ ثَلاَثًا')]
  const docs = o.documents ?? [documentItem({ latest_version: versions[versions.length - 1] })]
  const head = () => versions[versions.length - 1]!

  server.use(
    http.get('*/api/v1/projects/12/documents', () => HttpResponse.json(envelope(docs, pg(docs.length)))),
    http.post('*/api/v1/projects/12/documents', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.createdDocs.push(body)
      return HttpResponse.json(envelope(documentItem({ id: 77, title: body.title, latest_version: version(1, String(body.content), { document_id: 77 }) })), { status: 201 })
    }),
    http.get('*/api/v1/projects/12/documents/:id', ({ params }) => {
      const found = docs.find((d) => (d as { id: number }).id === Number(params.id))
      if (!found) return failure(404, 'NOT_FOUND', 'Document not found.')
      return HttpResponse.json(envelope({ ...found, latest_version: head() }))
    }),
    http.patch('*/api/v1/projects/12/documents/:id', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.patchedDocs.push(body)
      return HttpResponse.json(envelope({ ...documentItem(), ...body }))
    }),
    http.delete('*/api/v1/projects/12/documents/:id', ({ params }) => {
      calls.deletedDocs.push(String(params.id))
      return HttpResponse.json(envelope(null))
    }),
    http.get('*/api/v1/projects/12/documents/:id/draft', () =>
      HttpResponse.json(envelope(o.draft ?? { draft_content: null, draft_base_version: null, last_saved_at: null, saved_by_id: null })),
    ),
    http.put('*/api/v1/projects/12/documents/:id/draft', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.drafts.push(body)
      return o.putDraft?.(body) ?? HttpResponse.json(envelope({ saved_by: 'Shilan Rashid', draft_base_version: body.base_version }))
    }),
    http.get('*/api/v1/projects/12/documents/:id/versions', () => HttpResponse.json(envelope([...versions].reverse()))),
    http.post('*/api/v1/projects/12/documents/:id/versions', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.versions.push(body)
      const custom = o.postVersion?.(body)
      if (custom) return custom
      if (body.expected_version !== head().version_number) {
        return failure(409, 'CONFLICT', 'Save rejected · conflict.', {
          current_version: head().version_number,
          current_content: head().content,
          current_author: 'Aras Kamal',
          saved_at: '2026-10-06T11:51:00Z',
        })
      }
      const saved = version(head().version_number + 1, String(body.content), { change_summary: body.change_summary ?? null })
      versions.push(saved)
      return HttpResponse.json(envelope(saved), { status: 201 })
    }),
    http.post('*/api/v1/projects/12/documents/:id/versions/:n/restore', ({ params }) => {
      calls.restores.push(String(params.n))
      const source = versions.find((v) => v.version_number === Number(params.n))!
      const restored = version(head().version_number + 1, source.content, { change_summary: `Restored from version ${params.n}` })
      versions.push(restored)
      return HttpResponse.json(envelope(restored), { status: 201 })
    }),
    http.post('*/api/v1/projects/12/documents/:id/cite', async ({ request }) => {
      const body = (await request.json()) as { evidence_id: number; mode?: string }
      return HttpResponse.json(
        envelope({
          evidence_id: body.evidence_id,
          resource_id: 70 + body.evidence_id,
          citation_type: body.mode ?? 'reference',
          formatted_citation: `_Sunan Abī Dāwūd, 106_, Vol. 1, p. 78 (EV-${body.evidence_id})`,
          missing_components: ['author', 'year'],
          has_incomplete_citation: true,
        }),
      )
    }),
    http.post('*/api/v1/projects/12/documents/:id/lock', () => {
      calls.locks++
      return (
        o.lock?.() ??
        HttpResponse.json(envelope({ document_id: 31, locked_by: 1, locked_at: '2026-10-06T10:00:00Z', expires_at: '2026-10-06T10:15:00Z' }))
      )
    }),
    http.post('*/api/v1/projects/12/documents/:id/unlock', () => {
      calls.unlocks++
      return HttpResponse.json(envelope(null))
    }),
    http.post('*/api/v1/projects/12/documents/:id/findings/:fid', ({ params }) => {
      calls.docLinks.push(String(params.fid))
      return HttpResponse.json(envelope(documentItem({ findings: [{ id: Number(params.fid), claim: 'Linked claim', status: 'provisional' }] })))
    }),
    http.delete('*/api/v1/projects/12/documents/:id/findings/:fid', ({ params }) => {
      calls.docUnlinks.push(String(params.fid))
      return HttpResponse.json(envelope(null))
    }),

    http.get('*/api/v1/projects/12/evidence', () => {
      const items = o.evidence ?? [evidenceItem(4), evidenceItem(7, { locator: null })]
      return HttpResponse.json(envelope(items, pg(items.length)))
    }),

    http.get('*/api/v1/projects/12/findings', () => {
      const items = o.findings ?? [findingItem(), findingItem({ id: 5, claim: 'A second claim', status: 'supported' })]
      return HttpResponse.json(envelope(items, pg(items.length)))
    }),
    http.post('*/api/v1/projects/12/findings', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.createdFindings.push(body)
      return HttpResponse.json(envelope(findingItem({ id: 9, ...body, evidence_items: [], documents: [] })), { status: 201 })
    }),
    http.get('*/api/v1/projects/12/findings/:id', ({ params }) => {
      calls.findingGets++
      const custom = o.getFinding?.(calls.findingGets)
      if (custom) return custom
      const found = (o.findings ?? [findingItem(), findingItem({ id: 5, claim: 'A second claim', status: 'supported' })]).find((f) => (f as { id: number }).id === Number(params.id))
      if (!found) return failure(404, 'NOT_FOUND', 'Finding not found.')
      return HttpResponse.json(envelope(found))
    }),
    http.patch('*/api/v1/projects/12/findings/:id', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.patchedFindings.push(body)
      const custom = o.patchFinding?.(body)
      if (custom) return custom
      return HttpResponse.json(envelope(findingItem({ id: Number(params.id), ...body, updated_at: '2026-10-06T09:00:00Z' })))
    }),
    http.delete('*/api/v1/projects/12/findings/:id', ({ params }) => {
      calls.deletedFindings.push(String(params.id))
      return HttpResponse.json(envelope(null))
    }),
    http.post('*/api/v1/projects/12/findings/:id/evidence', async ({ request }) => {
      calls.evidenceLinks.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json(envelope({}))
    }),
    http.delete('*/api/v1/projects/12/findings/:id/evidence/:eid', ({ params }) => {
      calls.evidenceUnlinks.push(String(params.eid))
      return HttpResponse.json(envelope(null))
    }),
  )
  return { calls, versions }
}
