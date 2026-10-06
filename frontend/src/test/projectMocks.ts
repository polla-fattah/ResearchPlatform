import { http, HttpResponse } from 'msw'
import { envelope, project } from './helpers'
import { server } from './server'

/** GET /projects/{id} for the signed-in test user (id 1, see mockMe). */
export const projectDetail = (over: Record<string, unknown> = {}) => ({
  id: 12,
  owner_id: 1,
  title: 'Chains of the wuḍūʾ reports in the Sunan collections',
  question: 'Do the Kufan chains of the "three times" wording share a common link?',
  scope: 'All 14 occurrences in the six Sunan collections.',
  primary_language: 'ar',
  languages: ['ar', 'ckb'],
  tags: ['wuḍūʾ'],
  stage: 'analysing',
  is_archived: false,
  is_deleted: false,
  archived_at: null,
  deleted_at: null,
  recovery_deadline: null,
  created_at: '2026-09-18T09:00:00Z',
  updated_at: '2026-10-04T09:00:00Z',
  owner: { id: 1, display_name: 'Shilan Rashid' },
  memberships: [{ user_id: 1, role: 'owner', status: 'accepted', user: { id: 1, display_name: 'Shilan Rashid' } }],
  ...over,
})

export const summary = (over: Record<string, unknown> = {}) => ({
  project_id: 12,
  stage: 'analysing',
  evidence_counts: { candidate: 7, included: 19, reviewed: 8, excluded: 3, unresolved: 1, total: 38 },
  resources_count: 12,
  saved_searches_count: 4,
  result_sets_count: 2,
  analyses_count: 3,
  findings_count: 6,
  documents_count: 2,
  open_tasks_count: 1,
  last_activity_at: '2026-10-04T09:00:00Z',
  ...over,
})

const page = (n: number) => ({
  pagination: { current_page: 1, per_page: 20, total_items: n, total_pages: 1, has_more: false },
})

interface ProjectApis {
  detail?: Record<string, unknown> | Response
  summary?: Record<string, unknown> | Response
  milestones?: unknown[]
  questions?: unknown[]
}

/** Handlers for everything the project shell and overview load. */
export function mockProjectApis(id = 12, o: ProjectApis = {}) {
  const asResponse = (v: Record<string, unknown> | Response | undefined, make: () => Record<string, unknown>) =>
    v instanceof Response ? v : HttpResponse.json(envelope(v ?? make()))
  server.use(
    http.get(`*/api/v1/projects/${id}`, () => asResponse(o.detail, () => projectDetail({ id }))),
    http.get(`*/api/v1/projects/${id}/summary`, () => asResponse(o.summary, () => summary({ project_id: id }))),
    http.get(`*/api/v1/projects/${id}/milestones`, () => HttpResponse.json(envelope(o.milestones ?? []))),
    http.get(`*/api/v1/projects/${id}/questions`, () => HttpResponse.json(envelope(o.questions ?? []))),
  )
}

type Row = ReturnType<typeof project>

/** GET /projects with the scope-aware counts the index tabs need. Records the query strings it receives. */
export function mockProjectList(
  rows: Partial<Record<'owned' | 'shared' | 'archived' | 'trash', Row[]>> = {},
  counts?: { owned: number; shared: number; archived: number; trash: number },
) {
  const seen: URLSearchParams[] = []
  server.use(
    http.get('*/api/v1/projects', ({ request }) => {
      const params = new URL(request.url).searchParams
      seen.push(params)
      const scope = (params.get('scope') ?? 'owned') as keyof typeof rows
      let list = rows[scope] ?? []
      const q = params.get('q')?.toLowerCase()
      if (q) list = list.filter((p) => p.title.toLowerCase().includes(q))
      const stage = params.get('stage')
      if (stage) list = list.filter((p) => p.stage === stage)
      return HttpResponse.json(
        envelope(list, {
          ...page(list.length),
          counts: counts ?? {
            owned: rows.owned?.length ?? 0,
            shared: rows.shared?.length ?? 0,
            archived: rows.archived?.length ?? 0,
            trash: rows.trash?.length ?? 0,
          },
        }),
      )
    }),
  )
  return seen
}
