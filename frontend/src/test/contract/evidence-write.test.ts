import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import {
  annotationSchema,
  dependenciesSchema,
  evidenceDetailSchema,
  evidenceItemSchema,
  historySchema,
} from '@/api/schemas/evidence'

/**
 * Write contract test for the evidence inspector: collects one item in a throwaway project, changes its
 * state, annotates it, promotes the annotation, links it to a finding, tries to remove it while in use,
 * proposes a correction, and cleans up. Opt-in:
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`evidence inspector (${BASE})`, () => {
  let token = ''
  let projectId = 0
  let resourceId = 0
  let libraryItemId = 0
  let evidenceId = 0
  let findingId = 0
  let annotationId = 0

  async function call(method: string, path: string, body?: unknown) {
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
    return { status: res.status, body: (text ? JSON.parse(text) : {}) as Record<string, any> }
  }
  const base = () => `/projects/${projectId}/evidence/${evidenceId}`

  it('signs in, creates a throwaway project and collects one evidence item', async () => {
    token = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    projectId = (
      await call('POST', '/projects', {
        title: `[contract-test] evidence ${new Date().toISOString().slice(0, 19)}`,
        question: 'Evidence contract',
        scope: 'Contract testing only.',
        languages: ['ar'],
        stage: 'scoping',
        tags: [],
      })
    ).body.data.id
    const lib = await call('POST', '/library/items', { resource_type: 'external', title: `[contract-test] source ${Date.now()}` })
    libraryItemId = lib.body.data.id
    resourceId = lib.body.data.resource_id
    const ev = await call('POST', `/projects/${projectId}/evidence`, {
      resource_id: resourceId,
      captured_text: 'نص للاختبار فقط',
      locator: 'p. 1',
    })
    expect(ev.status).toBe(201)
    evidenceId = evidenceItemSchema.parse(ev.body.data).id
    expect(ev.body.data.state).toBe('candidate')
  })

  it('lists and shows the item', async () => {
    const list = await call('GET', `/projects/${projectId}/evidence?state=candidate`)
    expect(list.status).toBe(200)
    z.array(evidenceItemSchema).parse(list.body.data)
    const show = await call('GET', base())
    expect(evidenceDetailSchema.parse(show.body.data).id).toBe(evidenceId)
  })

  // C-16: list rows embed the whole collector user, including e-mail address, roles and profile.
  it('C-16: evidence list rows carry only the collector’s id and display name', async () => {
    const list = await call('GET', `/projects/${projectId}/evidence`)
    expect(JSON.stringify(list.body.data)).not.toMatch(/"email"/)
  })

  it('changes the state with a reason and records it in the history', async () => {
    const res = await call('PATCH', base(), { state: 'excluded', state_reason: 'Out of scope for this question' })
    expect(res.status).toBe(200)
    expect(res.body.data.state).toBe('excluded')
    expect(res.body.data.exclusion_reason).toBe('Out of scope for this question')
    const history = historySchema.parse((await call('GET', `${base()}/history`)).body.data)
    expect(history.history.length).toBeGreaterThan(0)
    expect(history.history[0]?.summary).toMatch(/excluded/)
  })

  it('reads the state back after a return to included', async () => {
    const res = await call('PATCH', base(), { state: 'included' })
    expect(res.body.data.state).toBe('included')
  })

  it('adds a private annotation and a scholarly judgment with its attribution', async () => {
    const note = await call('POST', `${base()}/annotations`, { annotation_kind: 'interpretation', body: 'my reading', visibility: 'private' })
    expect(note.status).toBe(201)
    const parsed = annotationSchema.parse(note.body.data)
    annotationId = parsed.id
    expect(parsed.visibility).toBe('private')
  })

  // C-16: the attribution fields are validated, then dropped (not fillable on Annotation).
  it('C-16: a scholarly judgment keeps who it is attributed to and where', async () => {
    const res = await call('POST', `${base()}/annotations`, {
      annotation_kind: 'scholarly_judgment',
      body: 'Judged weak',
      visibility: 'project_shared',
      attributed_to: 'al-Tirmidhī',
      source_locator: 'Sunan, k. al-ṭahāra, no. 12',
    })
    expect(res.body.data.attributed_to).toBe('al-Tirmidhī')
    expect(res.body.data.source_locator).toBe('Sunan, k. al-ṭahāra, no. 12')
  })

  it('promotes the private annotation to the project and lists it', async () => {
    const res = await call('PATCH', `${base()}/annotations/${annotationId}`, { visibility: 'project_shared' })
    expect(res.status).toBe(200)
    expect(res.body.data.visibility).toBe('project_shared')
    const list = z.array(annotationSchema).parse((await call('GET', `${base()}/annotations`)).body.data)
    expect(list.find((a) => a.id === annotationId)?.visibility).toBe('project_shared')
  })

  it('links the evidence to a finding, reports the dependency, and refuses removal until confirmed', async () => {
    const finding = await call('POST', `/projects/${projectId}/findings`, {
      question: 'Contract question?',
      claim: '[contract-test] claim',
      reasoning: 'Because.',
      status: 'provisional',
    })
    findingId = finding.body.data.id
    const link = await call('POST', `/projects/${projectId}/findings/${findingId}/evidence`, {
      evidence_id: evidenceId,
      relation_type: 'supporting',
      interpretation: 'Shows it',
    })
    expect(link.status).toBe(200)
    const deps = dependenciesSchema.parse((await call('GET', `${base()}/dependencies`)).body.data)
    expect(deps.findings.map((f) => f.id)).toContain(findingId)
    expect(deps.findings[0]?.pivot?.relation_type).toBe('supporting')

    const refused = await call('DELETE', base())
    expect(refused.status).toBe(409)
    expect(refused.body.error.code).toBe('HAS_DEPENDENCIES')
    expect(refused.body.error.details.findings_count).toBe(1)
  })

  // C-16: evidence_id is validated against ALL evidence, not this project's.
  it('C-16: a finding cannot link evidence that belongs to another project', async () => {
    const other = await call('GET', `/projects?scope=owned&per_page=100`)
    const otherProject = other.body.data.find((p: { id: number; evidence_count: number }) => p.id !== projectId && p.evidence_count > 0)
    if (!otherProject) throw new Error('needs another project that has evidence')
    const foreign = (await call('GET', `/projects/${otherProject.id}/evidence`)).body.data[0].id
    const res = await call('POST', `/projects/${projectId}/findings/${findingId}/evidence`, {
      evidence_id: foreign,
      relation_type: 'supporting',
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('submits a corpus correction proposal linked to the evidence', async () => {
    const res = await call('POST', '/corpus/proposals', {
      corpus_table: 'hadiths',
      corpus_id: 1,
      current_value: 'Unknown (not recorded)',
      proposed_value: 'p. 64',
      evidence_notes: '[contract-test] The printed edition shows this on page 64.',
      evidence_id: evidenceId,
    })
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('submitted')
  })

  it('removes the evidence once confirmed, and cleans up', async () => {
    expect((await call('DELETE', `${base()}?confirm=true`)).status).toBe(200)
    expect((await call('GET', base())).status).toBe(404)
    await call('DELETE', `/projects/${projectId}/findings/${findingId}`)
    expect((await call('DELETE', `/library/items/${libraryItemId}`)).status).toBe(200)
    expect((await call('DELETE', `/projects/${projectId}`)).status).toBe(200)
  })
})
