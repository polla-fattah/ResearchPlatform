import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { familyMemberSchema, familySchema } from '@/api/schemas/families'

/**
 * Contract test for hadith families (screen 28). It makes a family in a throwaway project, adds and removes members,
 * and trashes the project. Known backend defects are `it.fails` (request file C-35). WRITTEN FROM THE BACKEND CODE AND
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`hadith families (${BASE})`, () => {
  const stamp = Date.now()
  let owner = ''
  let projectId = 0
  let familyId = 0
  let memberId = 0

  const asOwner = (method: string, path: string, body?: unknown) => call(method, `/projects/${projectId}${path}`, body, owner)

  it('sets up a project', async () => {
    owner = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    projectId = (await call('POST', '/projects', { title: `[contract-test] families ${stamp}`, question: 'Families?', scope: 'Contract testing only.', languages: ['ar'], stage: 'analysing', tags: [] }, owner)).body.data.id
    expect(projectId).toBeGreaterThan(0)
  })

  it('makes a family and lists it with its members', async () => {
    const res = await asOwner('POST', '/families', { canonical_title: `Family ${stamp}`, root_companion: 'ʿUthmān', core_theme: 'Washing three times.' })
    expect(res.status).toBe(201)
    familyId = familySchema.parse(res.body.data).id
    const list = z.array(familySchema).parse((await asOwner('GET', '/families')).body.data)
    expect(list.find((f) => f.id === familyId)?.members).toEqual([])
  })

  it('adds a corpus report with a relationship and reads it back', async () => {
    const res = await asOwner('POST', `/families/${familyId}/members`, { corpus_hadith_id: 1, relationship_type: 'candidate', scholarly_notes: 'note' })
    expect(res.status).toBe(201)
    const m = familyMemberSchema.parse(res.body.data)
    memberId = m.id
    expect(m.relationship_type).toBe('candidate')
    const list = z.array(familySchema).parse((await asOwner('GET', '/families')).body.data)
    expect(list.find((f) => f.id === familyId)?.members.map((x) => x.id)).toContain(memberId)
  })

  it('refuses a relationship outside the fixed set', async () => {
    const res = await asOwner('POST', `/families/${familyId}/members`, { corpus_hadith_id: 1, relationship_type: 'made_up' })
    expect(res.status).toBe(422)
  })

  it('removes a member', async () => {
    expect((await asOwner('DELETE', `/families/${familyId}/members/${memberId}`)).status).toBe(200)
    const list = z.array(familySchema).parse((await asOwner('GET', '/families')).body.data)
    expect(list.find((f) => f.id === familyId)?.members).toEqual([])
  })

  it('C-35: a member must say what it is (a report or evidence), not nothing', async () => {
    const res = await asOwner('POST', `/families/${familyId}/members`, { relationship_type: 'shahid' })
    expect(res.status).toBe(422)
  })

  it('C-35: the same report is not added to a family twice', async () => {
    await asOwner('POST', `/families/${familyId}/members`, { corpus_hadith_id: 1, relationship_type: 'shahid' })
    const again = await asOwner('POST', `/families/${familyId}/members`, { corpus_hadith_id: 1, relationship_type: 'shahid' })
    expect(again.status).toBe(422)
  })

  it('C-35: a report that is not in the corpus is refused', async () => {
    const res = await asOwner('POST', `/families/${familyId}/members`, { corpus_hadith_id: 999999999, relationship_type: 'shahid' })
    expect(res.status).toBe(422)
  })

  it('C-35: a family can be renamed and deleted', async () => {
    const renamed = await asOwner('PATCH', `/families/${familyId}`, { canonical_title: 'Renamed' })
    expect(renamed.status).toBe(200)
    expect((await asOwner('DELETE', `/families/${familyId}`)).status).toBe(200)
  })

  it('cleans up: trashes the project', async () => {
    expect((await call('DELETE', `/projects/${projectId}`, undefined, owner)).status).toBe(200)
  })
})
