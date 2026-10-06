import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { assertionSchema, assessmentSchema, trajectorySchema } from '@/api/schemas/narratorDossier'

/**
 * Contract test for the narrator dossier (screen 30). It records an assertion and a teacher-specific assessment in a
 * throwaway project, reads them back, and trashes the project. It never writes a trajectory: that route is shared by all
 * projects and unprotected (C-37). Known backend defects are `it.fails` (request file C-37). WRITTEN FROM THE BACKEND CODE AND
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`narrator dossier (${BASE})`, () => {
  const stamp = Date.now()
  let owner = ''
  let projectId = 0
  let assertionId = 0
  const narratorId = 1
  const teacherId = 2

  const asOwner = (method: string, path: string, body?: unknown) => call(method, `/projects/${projectId}${path}`, body, owner)

  it('sets up a project', async () => {
    owner = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    projectId = (await call('POST', '/projects', { title: `[contract-test] narrator ${stamp}`, question: 'Narrator?', scope: 'Contract testing only.', languages: ['ar'], stage: 'analysing', tags: [] }, owner)).body.data.id
    expect(projectId).toBeGreaterThan(0)
  })

  it('records an assertion about a narrator and finds it among the narrator’s', async () => {
    const res = await asOwner('POST', '/assertions', { subject_type: 'narrator', subject_id: narratorId, subject_name: 'N', assertion_claim: `Died in 197 AH ${stamp}`, uncertainty_level: 'contested', competing_alternatives: [{ claim: '196 AH', source: 'x' }] })
    expect(res.status).toBe(201)
    assertionId = assertionSchema.parse(res.body.data).id
    const list = z.array(assertionSchema).parse((await asOwner('GET', '/assertions?subject_type=narrator')).body.data)
    expect(list.find((a) => a.id === assertionId)?.competing_alternatives).toHaveLength(1)
  })

  it('updates the claim and level, and deletes it', async () => {
    const res = await asOwner('PATCH', `/assertions/${assertionId}`, { assertion_claim: 'Changed', uncertainty_level: 'certain' })
    expect(assertionSchema.parse(res.body.data).assertion_claim).toBe('Changed')
    expect((await asOwner('DELETE', `/assertions/${assertionId}`)).status).toBe(200)
  })

  it('records a teacher-specific assessment and lists it by narrator', async () => {
    const res = await asOwner('POST', '/narrator-assessments', { narrator_id: narratorId, teacher_id: teacherId, assessment_category: 'sound', qawl_text: `Sound ${stamp}` })
    expect(res.status).toBe(201)
    const list = z.array(assessmentSchema).parse((await asOwner('GET', `/narrator-assessments?narrator_id=${narratorId}`)).body.data)
    expect(list.some((a) => a.qawl_text === `Sound ${stamp}`)).toBe(true)
  })

  it('answers a trajectory for a narrator (shared data, read only)', async () => {
    const res = await call('GET', `/geospatial/narrators/${narratorId}/trajectory`, undefined, owner)
    expect(res.status).toBe(200)
    expect(trajectorySchema.parse(res.body.data).narrator_id).toBe(narratorId)
  })

  it.fails('C-37: the list of a narrator’s assertions can be asked for by narrator, not only by type', async () => {
    const list = z.array(assertionSchema).parse((await asOwner('GET', `/assertions?subject_type=narrator&subject_id=${narratorId + 1000}`)).body.data)
    expect(list.every((a) => a.subject_id === narratorId + 1000)).toBe(true)
  })

  it.fails('C-37: an assessment for a narrator or teacher that is not in the corpus is refused', async () => {
    const res = await asOwner('POST', '/narrator-assessments', { narrator_id: 999999999, teacher_id: 999999998, assessment_category: 'sound', qawl_text: 'x' })
    expect(res.status).toBe(422)
  })

  it.fails('C-37: an assertion can carry a year and a source as fields', async () => {
    const res = await asOwner('POST', '/assertions', { subject_type: 'narrator', subject_id: narratorId, subject_name: 'N', assertion_claim: 'Died', year_hijri: 197, source: 'Taqrib' })
    expect(assertionSchema.parse(res.body.data)).toHaveProperty('year_hijri', 197)
  })

  it.fails('C-37: a stored empty value can clear an adjudication note', async () => {
    const made = assertionSchema.parse((await asOwner('POST', '/assertions', { subject_type: 'narrator', subject_id: narratorId, subject_name: 'N', assertion_claim: 'c', adjudication_notes: 'n' })).body.data)
    const res = await asOwner('PATCH', `/assertions/${made.id}`, { adjudication_notes: '' })
    expect(assertionSchema.parse(res.body.data).adjudication_notes ?? '').toBe('')
  })

  it.fails('C-37: a trajectory cannot be written by any approved researcher into data shared by every project', async () => {
    const res = await call('POST', '/geospatial/trajectories', { narrator_id: 999999999, place_id: 1, trajectory_type: 'birth' }, owner)
    expect(res.status).toBe(403)
  })

  it('cleans up: trashes the project', async () => {
    expect((await call('DELETE', `/projects/${projectId}`, undefined, owner)).status).toBe(200)
  })
})
