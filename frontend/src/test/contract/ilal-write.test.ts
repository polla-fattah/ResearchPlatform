import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ilalCaseSchema } from '@/api/schemas/ilal'

/**
 * Contract test for ʿilal cases (screen 29). It makes a case in a throwaway project, adds a version and a critic
 * statement, concludes it, and trashes the project. Known backend defects are `it.fails` (request file C-36). WRITTEN FROM THE BACKEND CODE AND
 * NOT YET RUN against a live server (the cloud session has no PHP 8.4). Opt-in for the write part:
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
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`ilal cases (${BASE})`, () => {
  const stamp = Date.now()
  let owner = ''
  let projectId = 0
  let caseId = 0

  const asOwner = (method: string, path: string, body?: unknown) => call(method, `/projects/${projectId}${path}`, body, owner)

  it('sets up a project', async () => {
    owner = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    projectId = (await call('POST', '/projects', { title: `[contract-test] ilal ${stamp}`, question: 'Ilal?', scope: 'Contract testing only.', languages: ['ar'], stage: 'analysing', tags: [] }, owner)).body.data.id
    expect(projectId).toBeGreaterThan(0)
  })

  it('opens a case that starts under investigation and lists it', async () => {
    const res = await asOwner('POST', '/ilal-cases', { title: `Case ${stamp}`, discrepancy_category: 'ikhtilaf_sanad' })
    expect(res.status).toBe(201)
    const made = ilalCaseSchema.parse(res.body.data)
    caseId = made.id
    expect(made.status).toBe('under_investigation')
    const list = z.array(ilalCaseSchema).parse((await asOwner('GET', '/ilal-cases')).body.data)
    expect(list.some((c) => c.id === caseId)).toBe(true)
  })

  it('refuses a kind of discrepancy outside the fixed set', async () => {
    expect((await asOwner('POST', '/ilal-cases', { title: 'x', discrepancy_category: 'made_up' })).status).toBe(422)
  })

  it('stores versions and critic statements and concludes the case, reading each back', async () => {
    const variants = [{ name: 'Version A', matn: 'a' }, { name: 'Version B', matn: 'b' }]
    const critics = [{ critic: 'Someone', verdict: 'Prefers A', source: 'Book 1/2', favours: 'Version A' }]
    const res = await asOwner('PATCH', `/ilal-cases/${caseId}`, { competing_variants: variants, critics_judgments: critics, status: 'resolved_defective', preferred_version: 'Version A', resolution_notes: 'Because.' })
    expect(res.status).toBe(200)
    const back = ilalCaseSchema.parse((await asOwner('GET', `/ilal-cases/${caseId}`)).body.data)
    expect(back.competing_variants.map((v) => v.name)).toEqual(['Version A', 'Version B'])
    expect(back.critics_judgments[0]?.favours).toBe('Version A')
    expect([back.status, back.preferred_version, back.resolution_notes]).toEqual(['resolved_defective', 'Version A', 'Because.'])
  })

  it('refuses a status outside the fixed set', async () => {
    expect((await asOwner('PATCH', `/ilal-cases/${caseId}`, { status: 'made_up' })).status).toBe(422)
  })

  it('C-36: a case with fewer than two versions cannot be concluded', async () => {
    const made = ilalCaseSchema.parse((await asOwner('POST', '/ilal-cases', { title: 'Empty', discrepancy_category: 'qalb' })).body.data)
    expect((await asOwner('PATCH', `/ilal-cases/${made.id}`, { status: 'resolved_authentic' })).status).toBe(422)
  })

  it('C-36: the preferred version must be one of the case’s versions', async () => {
    expect((await asOwner('PATCH', `/ilal-cases/${caseId}`, { preferred_version: 'Not a version' })).status).toBe(422)
  })

  it('C-36: a stale write is refused instead of overwriting a teammate’s change', async () => {
    const before = ilalCaseSchema.parse((await asOwner('GET', `/ilal-cases/${caseId}`)).body.data)
    await asOwner('PATCH', `/ilal-cases/${caseId}`, { resolution_notes: 'Teammate wrote this.' })
    const stale = await asOwner('PATCH', `/ilal-cases/${caseId}`, { resolution_notes: 'Overwrite', expected_updated_at: before.updated_at })
    expect(stale.status).toBe(409)
  })

  it('C-36: a case can be deleted', async () => {
    expect((await asOwner('DELETE', `/ilal-cases/${caseId}`)).status).toBe(200)
  })

  it('cleans up: trashes the project', async () => {
    expect((await call('DELETE', `/projects/${projectId}`, undefined, owner)).status).toBe(200)
  })
})
