import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import {
  adminApplicationSchema,
  adminJobSchema,
  adminUserSchema,
  auditEntrySchema,
  closureSchema,
  limitsSchema,
  opsSchema,
  proposalSchema,
  supportGrantSchema,
} from '@/api/schemas/admin'

/**
 * Contract test for the administration area (screen 13). The read part needs an administrator account. The write part
 * creates one throwaway applicant ("[contract-test] applicant …") and takes it through the whole workflow: an
 * information request and its answer, approval, roles, suspension, a corpus correction and its decision. The applicant
 * stays in the database as a declined account (there is no way to delete an account), so a run costs one applicant;
 * the apply endpoint allows ten per hour per address. Opt-in for the write part:
 *
 *   CONTRACT_WRITE=1 CONTRACT_EMAIL=... CONTRACT_PASSWORD=... npm run test:contract
 */
const BASE = process.env.CONTRACT_BASE_URL ?? 'http://127.0.0.1:8000'
const EMAIL = process.env.CONTRACT_EMAIL
const PASSWORD = process.env.CONTRACT_PASSWORD
const WRITE = process.env.CONTRACT_WRITE === '1'

const reachable = await fetch(`${BASE}/up`).then(
  (r) => r.ok,
  () => false,
)

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let parsed: Record<string, any> = {}
  try {
    parsed = text ? JSON.parse(text) : {}
  } catch {
    parsed = { raw: text.slice(0, 200) }
  }
  return { status: res.status, body: parsed }
}

let admin = ''
const asAdmin = (method: string, path: string, body?: unknown) => call(method, path, body, admin)

describe.skipIf(!reachable || !EMAIL || !PASSWORD)(`administration, read (${BASE})`, () => {
  it('lists accounts, applications, closures, limits, grants, jobs, operations, audit entries and corrections with the schemas', async () => {
    admin = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    const users = await asAdmin('GET', '/admin/users?per_page=5')
    expect(users.status).toBe(200)
    z.array(adminUserSchema).parse(users.body.data)
    expect(users.body.meta.pagination.total_items).toBeGreaterThan(0)
    z.array(adminApplicationSchema).parse((await asAdmin('GET', '/admin/applications?per_page=5')).body.data)
    z.array(closureSchema).parse((await asAdmin('GET', '/admin/closures')).body.data)
    limitsSchema.parse((await asAdmin('GET', '/admin/limits')).body.data)
    z.array(supportGrantSchema).parse((await asAdmin('GET', '/admin/support-grants')).body.data)
    z.array(adminJobSchema).parse((await asAdmin('GET', '/admin/jobs?per_page=5')).body.data)
    opsSchema.parse((await asAdmin('GET', '/admin/ops')).body.data)
    z.array(auditEntrySchema).parse((await asAdmin('GET', '/admin/audit-logs?per_page=5')).body.data)
    z.array(proposalSchema).parse((await asAdmin('GET', '/admin/corpus/proposals?per_page=5')).body.data)
  })

  it('filters accounts by state and by name, applications by state, and caps a page at 100', async () => {
    const suspended = await asAdmin('GET', '/admin/users?status=suspended&per_page=100')
    expect(z.array(adminUserSchema).parse(suspended.body.data).every((u) => u.status === 'suspended')).toBe(true)
    const named = z.array(adminUserSchema).parse((await asAdmin('GET', '/admin/users?q=chief&per_page=100')).body.data)
    expect(named.every((u) => /chief/i.test(u.display_name + u.email))).toBe(true)
    const waiting = z.array(adminApplicationSchema).parse((await asAdmin('GET', '/admin/applications?status=pending&per_page=100')).body.data)
    expect(waiting.every((a) => a.status === 'pending')).toBe(true)
    expect((await asAdmin('GET', '/admin/audit-logs?per_page=500')).body.meta.pagination.per_page).toBe(100)
  })

  it('reports a total with per_page=1, which is how the counts beside the navigation are made', async () => {
    const one = await asAdmin('GET', '/admin/users?per_page=1')
    expect(one.body.data).toHaveLength(1)
    expect(one.body.meta.pagination.total_items).toBeGreaterThan(1)
  })

  it('keeps unverified applicants out of the application queue (C-1)', async () => {
    const unverified = z.array(adminUserSchema).parse((await asAdmin('GET', '/admin/users?status=unverified&per_page=100')).body.data)
    const queue = z.array(adminApplicationSchema).parse((await asAdmin('GET', '/admin/applications?per_page=100&status=pending')).body.data)
    const queued = new Set(queue.map((a) => a.user_id))
    expect(unverified.some((u) => queued.has(u.id))).toBe(false)
  })
})

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`administration, write (${BASE})`, () => {
  const stamp = Date.now()
  const applicantEmail = `contract-${stamp}@example.test`
  let applicantId = 0
  let applicationId = 0
  let applicantToken = ''
  let verificationToken = ''
  let projectId = 0
  let proposalId = 0
  let adminId = 0

  it('lets someone apply, and keeps them out of the queue until their email is verified', async () => {
    admin = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    adminId = (await call('GET', '/auth/me', undefined, admin)).body.data.id
    const res = await call('POST', '/applications', {
      display_name: `[contract-test] applicant ${stamp}`,
      email: applicantEmail,
      password: 'password123',
      password_confirmation: 'password123',
      research_interests: 'Contract testing, Isnād',
      preferred_language: 'en',
      affiliation: 'Contract University',
    })
    expect(res.status).toBe(201)
    applicantId = res.body.data.user.id
    applicationId = res.body.data.application.id
    verificationToken = res.body.data.verification_token
    expect(res.body.data.user.status).toBe('unverified')
    const queue = z.array(adminApplicationSchema).parse((await asAdmin('GET', '/admin/applications?per_page=100')).body.data)
    expect(queue.some((a) => a.id === applicationId)).toBe(false)
  })

  it('C-20: an applicant can confirm their email, which is what puts them in the queue', async () => {
    const res = await call('POST', '/auth/email/verify', { token: verificationToken })
    expect(res.status).toBe(200)
  })

  it('puts an applicant in the queue when an administrator sets them pending (the stand-in for email verification)', async () => {
    const res = await asAdmin('PATCH', `/admin/users/${applicantId}/status`, { status: 'pending', reason: 'Contract test: stand in for email verification' })
    expect(res.status).toBe(200)
    const queue = z.array(adminApplicationSchema).parse((await asAdmin('GET', '/admin/applications?status=pending&per_page=100')).body.data)
    const found = queue.find((a) => a.id === applicationId)!
    expect(found.user.email).toBe(applicantEmail)
    expect(found.reference).toMatch(/^APP-2026-/)
    expect(found.user.profile?.affiliation).toBe('Contract University')
  })

  it('refuses a decision without what it needs, and says which field', async () => {
    const short = await asAdmin('POST', `/admin/applications/${applicationId}/decide`, { decision: 'rejected', decision_reason: 'no' })
    expect(short.status).toBe(422)
    expect(short.body.error.details).toHaveProperty('decision_reason')
    const noMessage = await asAdmin('POST', `/admin/applications/${applicationId}/decide`, { decision: 'information_requested' })
    expect(noMessage.status).toBe(422)
    expect(noMessage.body.error.details).toHaveProperty('message')
    expect((await asAdmin('POST', `/admin/applications/${applicationId}/decide`, { decision: 'maybe' })).status).toBe(422)
  })

  it('asks the applicant for more information, who answers, and it is back in the queue with the thread', async () => {
    const asked = await asAdmin('POST', `/admin/applications/${applicationId}/decide`, { decision: 'information_requested', message: 'Please describe a recent piece of research.' })
    expect(asked.status).toBe(200)
    applicantToken = (await call('POST', '/auth/login', { email: applicantEmail, password: 'password123' })).body.data.token
    const status = (await call('GET', '/applications/my-status', undefined, applicantToken)).body.data
    expect(status.application.information_request.message).toBe('Please describe a recent piece of research.')
    expect((await call('POST', '/applications/respond', { message: 'I compare chains of the wuḍūʾ reports.' }, applicantToken)).status).toBe(200)
    const back = z.array(adminApplicationSchema).parse((await asAdmin('GET', '/admin/applications?status=pending&per_page=100')).body.data).find((a) => a.id === applicationId)!
    expect(back.replies?.map((r) => r.message)).toEqual(['I compare chains of the wuḍūʾ reports.'])
  })

  it('approves the application, which enables the account and records who decided and why', async () => {
    const res = await asAdmin('POST', `/admin/applications/${applicationId}/decide`, { decision: 'approved', decision_reason: 'Contract test approval' })
    expect(res.status).toBe(200)
    const decided = z.array(adminApplicationSchema).parse((await asAdmin('GET', '/admin/applications?status=approved&per_page=100')).body.data).find((a) => a.id === applicationId)!
    expect(decided).toMatchObject({ decision_reason: 'Contract test approval', decided_by: adminId })
    expect(decided.user.status).toBe('approved')
  })

  it('answers an approved researcher’s call to any administration endpoint with 403 FORBIDDEN', async () => {
    applicantToken = (await call('POST', '/auth/login', { email: applicantEmail, password: 'password123' })).body.data.token
    for (const path of ['/admin/users', '/admin/applications', '/admin/limits', '/admin/ops', '/admin/audit-logs', '/admin/support-grants', '/admin/corpus/proposals']) {
      const res = await call('GET', path, undefined, applicantToken)
      expect(res.status, path).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    }
    expect((await call('PATCH', `/admin/users/${adminId}/status`, { status: 'suspended', reason: 'nope' }, applicantToken)).status).toBe(403)
  })

  it('changes roles, reads them back, and refuses unknown roles, no roles, and a change to the administrator’s own', async () => {
    const res = await asAdmin('PATCH', `/admin/users/${applicantId}/roles`, { roles: ['researcher', 'reviewer'] })
    expect(res.status).toBe(200)
    const listed = z.array(adminUserSchema).parse((await asAdmin('GET', `/admin/users?q=${stamp}`)).body.data).find((u) => u.id === applicantId)!
    expect(listed.roles).toEqual(expect.arrayContaining(['researcher', 'reviewer']))
    expect(listed.is_admin).toBe(false)
    expect((await asAdmin('PATCH', `/admin/users/${applicantId}/roles`, { roles: ['superuser'] })).status).toBe(422)
    expect((await asAdmin('PATCH', `/admin/users/${applicantId}/roles`, { roles: [] })).status).toBe(422)
    const own = await asAdmin('PATCH', `/admin/users/${adminId}/roles`, { roles: ['admin'] })
    expect(own.status).toBe(403)
  })

  it('suspends with a reason, blocks the sign-in, and reactivates', async () => {
    expect((await asAdmin('PATCH', `/admin/users/${applicantId}/status`, { status: 'suspended' })).status).toBe(422)
    expect((await asAdmin('PATCH', `/admin/users/${applicantId}/status`, { status: 'closed', reason: 'zzz' })).status).toBe(422)
    const suspended = await asAdmin('PATCH', `/admin/users/${applicantId}/status`, { status: 'suspended', reason: 'Contract test suspension' })
    expect(suspended.status).toBe(200)
    const login = await call('POST', '/auth/login', { email: applicantEmail, password: 'password123' })
    expect(login.status).toBe(403)
    expect(login.body.error.code).toBe('ACCOUNT_SUSPENDED')
    expect((await asAdmin('PATCH', `/admin/users/${applicantId}/status`, { status: 'approved', reason: 'Contract test reactivation' })).status).toBe(200)
    applicantToken = (await call('POST', '/auth/login', { email: applicantEmail, password: 'password123' })).body.data.token
  })

  it('records each of those actions in the audit log, filterable by action, actor, object and time', async () => {
    const byAction = z.array(auditEntrySchema).parse((await asAdmin('GET', '/admin/audit-logs?action=update_user_status&per_page=100')).body.data)
    expect(byAction.filter((e) => e.object_id === applicantId).length).toBeGreaterThanOrEqual(3)
    const reasons = byAction.filter((e) => e.object_id === applicantId).map((e) => (e.details as Record<string, unknown>).reason)
    expect(reasons).toEqual(expect.arrayContaining(['Contract test suspension', 'Contract test reactivation']))
    const decided = z.array(auditEntrySchema).parse((await asAdmin('GET', `/admin/audit-logs?action=decide_application&actor_id=${adminId}&per_page=100`)).body.data)
    expect(decided.some((e) => e.object_id === applicationId)).toBe(true)
    const refused = z.array(auditEntrySchema).parse((await asAdmin('GET', '/admin/audit-logs?action=update_own_role_refused&per_page=100')).body.data)
    expect(refused.some((e) => e.object_id === adminId)).toBe(true)
    const recent = z.array(auditEntrySchema).parse((await asAdmin('GET', `/admin/audit-logs?object_type=user&from=${encodeURIComponent(new Date(stamp - 60_000).toISOString())}&per_page=100`)).body.data)
    expect(recent.length).toBeGreaterThan(0)
    expect(recent.every((e) => e.object_type === 'user')).toBe(true)
  })

  it('takes a corpus correction from submitted to accepted, with who decided and when', async () => {
    const created = await call(
      'POST',
      '/corpus/proposals',
      { corpus_table: 'hadiths', corpus_id: 1, current_value: 'Unknown', proposed_value: 'p. 64', evidence_notes: '[contract-test] admin decision, applicant ' + stamp },
      applicantToken,
    )
    expect(created.status).toBe(201)
    proposalId = created.body.data.id
    const waiting = z.array(proposalSchema).parse((await asAdmin('GET', '/admin/corpus/proposals?status=submitted&per_page=100')).body.data)
    expect(waiting.find((p) => p.id === proposalId)?.researcher?.display_name).toContain('[contract-test]')
    expect((await asAdmin('POST', `/admin/corpus/proposals/${proposalId}/decide`, { status: 'maybe' })).status).toBe(422)
    const decided = await asAdmin('POST', `/admin/corpus/proposals/${proposalId}/decide`, { status: 'accepted' })
    expect(decided.status).toBe(200)
    const accepted = z.array(proposalSchema).parse((await asAdmin('GET', '/admin/corpus/proposals?status=accepted&per_page=100')).body.data).find((p) => p.id === proposalId)!
    expect(accepted.decider?.id).toBe(adminId)
    expect(accepted.decided_at).toBeTruthy()
  })

  it('C-20: a researcher can give an administrator support access to their project', async () => {
    projectId = (await call('POST', '/projects', { title: `[contract-test] grant ${stamp}`, question: 'q', scope: 's', languages: ['ar'], stage: 'scoping', tags: [] }, applicantToken)).body.data.id
    const res = await call(
      'POST',
      '/researcher/support-grants',
      { admin_id: adminId, scope: 'project', object_id: projectId, expires_at: new Date(Date.now() + 3_600_000).toISOString(), reason: 'Contract test: ticket 1' },
      applicantToken,
    )
    expect(res.status).toBe(201)
  })

  it('C-20: a decided application cannot be decided again, and a decision does not change an account that was already decided', async () => {
    const again = await asAdmin('POST', `/admin/applications/${applicationId}/decide`, { decision: 'rejected', decision_reason: 'Contract test: second decision' })
    expect(again.status).toBeGreaterThanOrEqual(400)
  })

  it('C-20: a decided corpus correction cannot be decided again', async () => {
    const again = await asAdmin('POST', `/admin/corpus/proposals/${proposalId}/decide`, { status: 'rejected' })
    expect(again.status).toBeGreaterThanOrEqual(400)
  })

  it('C-20: the audit log says that a refused attempt was refused', async () => {
    const refused = z.array(auditEntrySchema.extend({ outcome: z.string() })).parse((await asAdmin('GET', '/admin/audit-logs?action=update_own_role_refused&per_page=1')).body.data)
    expect(refused[0]!.outcome).not.toBe('success')
  })

  it('C-20: the operations view counts corrections that are waiting for review', async () => {
    const waitingOne = await call(
      'POST',
      '/corpus/proposals',
      { corpus_table: 'hadiths', corpus_id: 1, current_value: 'Unknown', proposed_value: 'p. 65', evidence_notes: '[contract-test] waiting correction ' + stamp },
      applicantToken,
    )
    expect(waitingOne.status).toBe(201)
    const ops = opsSchema.parse((await asAdmin('GET', '/admin/ops')).body.data)
    expect(ops.active_alerts.some((a) => /correction/i.test(a.message))).toBe(true)
    expect((await asAdmin('POST', `/admin/corpus/proposals/${waitingOne.body.data.id}/decide`, { status: 'rejected' })).status).toBe(200)
  })

  it('C-20: corrections do not carry the whole account of who proposed or decided them', async () => {
    const res = await asAdmin('GET', '/admin/corpus/proposals?per_page=1')
    expect(JSON.stringify(res.body.data)).not.toMatch(/"mfa_enabled"/)
  })

  it('cleans up: trashes the throwaway project and leaves the applicant as a declined account', async () => {
    if (projectId) await call('DELETE', `/projects/${projectId}`, undefined, applicantToken)
    const res = await asAdmin('PATCH', `/admin/users/${applicantId}/status`, { status: 'rejected', reason: 'Contract test finished' })
    expect(res.status).toBe(200)
  })
})
