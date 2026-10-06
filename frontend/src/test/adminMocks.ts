import { http, HttpResponse } from 'msw'
import { envelope } from './helpers'
import { server } from './server'

const pg = (total: number, page = 1, perPage = 20) => ({
  pagination: { current_page: page, per_page: perPage, total_items: total, total_pages: Math.max(1, Math.ceil(total / perPage)), has_more: page * perPage < total },
})
const failure = (status: number, code: string, message: string) => HttpResponse.json({ success: false, error: { code, message, details: [] } }, { status })

type Row = Record<string, unknown>

export const adminUser = (over: Row = {}): Row => ({
  id: 7,
  code: 'USR-0007',
  display_name: 'Hêro Salih',
  email: 'hero@example.org',
  roles: ['researcher', 'corpus_editor'],
  status: 'approved',
  is_admin: false,
  mfa: 'totp',
  created_at: '2026-09-01T10:00:00Z',
  last_login_at: null,
  ...over,
})

export const application = (over: Row = {}): Row => ({
  id: 417,
  user_id: 142,
  status: 'pending',
  reference: 'APP-2026-0417',
  research_statement: 'Takhrīj of reports on ritual purity; narrator criticism in early Kufan transmission',
  decision_reason: null,
  decided_by: null,
  decided_at: null,
  created_at: '2026-10-02T14:11:00Z',
  information_request: null,
  user: {
    id: 142,
    display_name: 'Shilan Rashid',
    email: 'shilan@example.org',
    preferred_language: 'ckb',
    status: 'pending',
    is_admin: true,
    roles: ['applicant'],
    profile: { affiliation: null, biography: null, research_interests: ['Takhrīj'] },
  },
  replies: [],
  ...over,
})

export const grant = (over: Row = {}): Row => ({
  id: 12,
  researcher_id: 142,
  admin_id: 1,
  scope: 'project',
  object_id: 15,
  expires_at: '2026-10-07T10:00:00Z',
  reason: 'Ticket #311: export failing on this project',
  created_at: '2026-10-06T10:00:00Z',
  researcher: { id: 142, display_name: 'Shilan Rashid' },
  admin: { id: 1, display_name: 'Karwan Aziz' },
  ...over,
})

export const auditEntry = (over: Row = {}): Row => ({
  id: 88412,
  code: 'AUD-88412',
  actor_id: 1,
  actor: { id: 1, display_name: 'Karwan Aziz', roles: ['applicant'] },
  action: 'decide_application',
  object_type: 'researcher_application',
  object_id: 409,
  outcome: 'success',
  details: { decision: 'approved', reason: 'Verified academic credentials.' },
  created_at: '2026-10-04T11:02:00Z',
  ...over,
})

export const proposal = (over: Row = {}): Row => ({
  id: 38,
  researcher_id: 142,
  corpus_table: 'hadiths',
  corpus_id: 88,
  current_value: 'Unknown (not recorded)',
  proposed_value: 'p. 64',
  evidence_notes: 'The printed edition shows this on page 64.',
  status: 'submitted',
  decided_by: null,
  decided_at: null,
  created_at: '2026-10-05T09:00:00Z',
  researcher: { id: 142, display_name: 'Shilan Rashid' },
  decider: null,
  ...over,
})

export const job = (over: Row = {}): Row => ({
  id: 60,
  requester_id: 142,
  scope: 'project',
  target_id: 15,
  format: 'zip',
  status: 'failed',
  progress: 'Packaging stopped',
  failure_reason: 'Storage timeout after 3 attempts',
  created_at: '2026-10-05T10:00:00Z',
  completed_at: null,
  ...over,
})

export interface AdminApis {
  users?: Row[]
  applications?: Row[]
  closures?: Row[]
  limits?: Record<string, unknown>
  grants?: Row[]
  jobs?: Row[]
  ops?: Record<string, unknown>
  audit?: Row[]
  proposals?: Row[]
  /** Overrides returning a Response to take over, or undefined to use the default. */
  decideApplication?: (body: Record<string, unknown>) => Response | undefined
  patchStatus?: (body: Record<string, unknown>) => Response | undefined
  patchRoles?: (body: Record<string, unknown>) => Response | undefined
  decideProposal?: (body: Record<string, unknown>) => Response | undefined
  list?: (path: string) => Response | undefined
}

/** Handlers for everything the administration area uses, stateful where a decision should change what is listed. */
export function mockAdmin(o: AdminApis = {}) {
  const users = o.users ?? [adminUser()]
  const applications = o.applications ?? [application()]
  const closures = o.closures ?? []
  const grants = o.grants ?? []
  const proposals = o.proposals ?? [proposal()]
  const calls = {
    userQueries: [] as URLSearchParams[],
    applicationQueries: [] as URLSearchParams[],
    auditQueries: [] as URLSearchParams[],
    proposalQueries: [] as URLSearchParams[],
    jobQueries: [] as URLSearchParams[],
    decisions: [] as { id: string; body: Record<string, unknown> }[],
    roles: [] as { id: string; body: Record<string, unknown> }[],
    statuses: [] as { id: string; body: Record<string, unknown> }[],
    closureDecisions: [] as { id: string; body: Record<string, unknown> }[],
    revoked: [] as string[],
    proposalDecisions: [] as { id: string; body: Record<string, unknown> }[],
  }
  const page = (list: Row[], request: Request) => {
    const params = new URL(request.url).searchParams
    const perPage = Number(params.get('per_page') ?? 20)
    const at = Number(params.get('page') ?? 1)
    return HttpResponse.json(envelope(list.slice((at - 1) * perPage, at * perPage), pg(list.length, at, perPage)))
  }

  server.use(
    http.get('*/api/v1/admin/users', ({ request }) => {
      const params = new URL(request.url).searchParams
      calls.userQueries.push(params)
      const custom = o.list?.('users')
      if (custom) return custom
      const q = params.get('q')?.toLowerCase()
      const status = params.get('status')
      const list = users.filter((u) => (!q || String(u.display_name).toLowerCase().includes(q) || String(u.email).toLowerCase().includes(q)) && (!status || u.status === status))
      return page(list, request)
    }),
    http.patch('*/api/v1/admin/users/:id/roles', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.roles.push({ id: String(params.id), body })
      const custom = o.patchRoles?.(body)
      if (custom) return custom
      const u = users.find((x) => x.id === Number(params.id))
      if (u) u.roles = body.roles
      return HttpResponse.json(envelope(u ?? {}))
    }),
    http.patch('*/api/v1/admin/users/:id/status', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.statuses.push({ id: String(params.id), body })
      const custom = o.patchStatus?.(body)
      if (custom) return custom
      const u = users.find((x) => x.id === Number(params.id))
      if (u) u.status = body.status
      return HttpResponse.json(envelope(u ?? {}))
    }),

    http.get('*/api/v1/admin/applications', ({ request }) => {
      const params = new URL(request.url).searchParams
      calls.applicationQueries.push(params)
      const custom = o.list?.('applications')
      if (custom) return custom
      const status = params.get('status')
      return page(applications.filter((a) => !status || a.status === status), request)
    }),
    http.post('*/api/v1/admin/applications/:id/decide', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.decisions.push({ id: String(params.id), body })
      const custom = o.decideApplication?.(body)
      if (custom) return custom
      const a = applications.find((x) => x.id === Number(params.id))
      if (a) {
        a.status = body.decision
        if (body.decision !== 'information_requested') {
          a.decision_reason = body.decision_reason ?? 'Administrative decision'
          a.decided_by = 1
          a.decided_at = '2026-10-06T10:00:00Z'
        }
      }
      return HttpResponse.json(envelope(a ?? {}))
    }),

    http.get('*/api/v1/admin/closures', ({ request }) => page(closures, request)),
    http.post('*/api/v1/admin/closures/:id/decide', async ({ request, params }) => {
      calls.closureDecisions.push({ id: String(params.id), body: (await request.json()) as Record<string, unknown> })
      const at = closures.findIndex((c) => c.id === Number(params.id))
      if (at >= 0) closures.splice(at, 1)
      return HttpResponse.json(envelope({}))
    }),

    http.get('*/api/v1/admin/limits', () =>
      HttpResponse.json(
        envelope(
          o.limits ?? {
            applications_per_email_per_day: 1,
            resend_verification_per_minute: 1,
            resend_verification_per_day: 5,
            invitations_per_project_per_day: 20,
            download_storage_limit_gb: 5,
            package_part_size_gb: 1,
            concurrent_export_jobs: 2,
            result_set_max_size: 5000,
          },
        ),
      ),
    ),
    http.get('*/api/v1/admin/support-grants', () => HttpResponse.json(envelope(grants))),
    http.delete('*/api/v1/researcher/support-grants/:id', ({ params }) => {
      calls.revoked.push(String(params.id))
      const at = grants.findIndex((g) => g.id === Number(params.id))
      if (at >= 0) grants.splice(at, 1)
      return HttpResponse.json(envelope(null))
    }),
    http.get('*/api/v1/admin/jobs', ({ request }) => {
      const params = new URL(request.url).searchParams
      calls.jobQueries.push(params)
      const status = params.get('status')
      return page((o.jobs ?? []).filter((j) => !status || j.status === status), request)
    }),
    http.get('*/api/v1/admin/ops', () => HttpResponse.json(envelope(o.ops ?? { queue_depth: 0, failures_count: 0, storage_used_bytes: 9596, active_alerts: [] }))),
    http.get('*/api/v1/admin/audit-logs', ({ request }) => {
      const params = new URL(request.url).searchParams
      calls.auditQueries.push(params)
      const custom = o.list?.('audit')
      if (custom) return custom
      const action = params.get('action')
      const objectType = params.get('object_type')
      const actor = params.get('actor_id')
      return page(
        (o.audit ?? []).filter((e) => (!action || e.action === action) && (!objectType || e.object_type === objectType) && (!actor || e.actor_id === Number(actor))),
        request,
      )
    }),
    http.get('*/api/v1/admin/corpus/proposals', ({ request }) => {
      const params = new URL(request.url).searchParams
      calls.proposalQueries.push(params)
      const status = params.get('status')
      return page(proposals.filter((p) => !status || p.status === status), request)
    }),
    http.post('*/api/v1/admin/corpus/proposals/:id/decide', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.proposalDecisions.push({ id: String(params.id), body })
      const custom = o.decideProposal?.(body)
      if (custom) return custom
      const p = proposals.find((x) => x.id === Number(params.id))
      if (p) {
        p.status = body.status
        p.decided_at = '2026-10-06T10:00:00Z'
        p.decider = { id: 1, display_name: 'Karwan Aziz' }
      }
      return HttpResponse.json(envelope(p ?? {}))
    }),
  )
  return { calls, users, applications, grants, proposals, failure }
}
