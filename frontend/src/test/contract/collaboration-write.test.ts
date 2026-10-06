import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { collaborationRequestSchema } from '@/api/schemas/collaboration'

/**
 * Contract test for collaboration requests (screen 40 and the owner's inbox on screen 15). It creates a throwaway
 * project with a published announcement, tries to send a request from the public endpoint, reads the inbox, and cleans up.
 * Known backend defects are `it.fails` (request file C-28; the first two are P0: the public endpoint cannot work today).
 * WRITTEN FROM THE BACKEND CODE AND NOT YET RUN against a live server (the cloud session has no PHP 8.4). Opt-in for the
 * write part:
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`collaboration requests (${BASE})`, () => {
  const stamp = Date.now()
  const slug = `contract-collab-${stamp}`
  let owner = ''
  let projectId = 0

  const asOwner = (method: string, path: string, body?: unknown) => call(method, `/projects/${projectId}${path}`, body, owner)
  const interest = (over: Record<string, unknown> = {}) => ({ name: 'Contract Tester', email: `tester-${stamp}@example.test`, affiliation: 'Nowhere', message: 'I can help with the manuscripts.', consent: true, ...over })

  it('sets up a project with a published announcement', async () => {
    owner = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    projectId = (await call('POST', '/projects', { title: `[contract-test] collab ${stamp}`, question: 'Collab?', scope: 'Contract testing only.', languages: ['en'], stage: 'scoping', tags: [] }, owner)).body.data.id
    expect((await asOwner('POST', '/announcement', { public_slug: slug, title: `[contract-test] ${stamp}`, summary: 'Ongoing.', research_stage: 'scoping', keywords: [], status: 'draft' })).status).toBe(200)
    expect((await asOwner('POST', '/announcement/publish')).status).toBe(200)
  })

  it.fails('C-28 (P0): a signed-in researcher can send a request from the public announcement', async () => {
    const res = await call('POST', `/public/announcements/${slug}/collaboration-requests`, interest(), owner)
    expect(res.status).toBe(202)
  })

  it.fails('C-28 (P0): the public endpoint refuses a request without consent or a message of ten characters', async () => {
    expect((await call('POST', `/public/announcements/${slug}/collaboration-requests`, interest({ consent: false }), owner)).status).toBe(422)
    expect((await call('POST', `/public/announcements/${slug}/collaboration-requests`, interest({ message: 'short' }), owner)).status).toBe(422)
  })

  it('refuses a request to one’s own project on the authenticated route', async () => {
    expect((await asOwner('POST', '/collaboration-requests', { message: 'A message long enough.', contact_email: 'me@example.test' })).status).toBe(422)
  })

  it('lists the inbox for the owner in the shape the screen reads', async () => {
    const res = await asOwner('GET', '/collaboration-requests')
    expect(res.status).toBe(200)
    z.array(collaborationRequestSchema).parse(res.body.data)
  })

  it.fails('C-28: the inbox does not embed the requester’s whole account', async () => {
    const res = await asOwner('GET', '/collaboration-requests')
    expect(JSON.stringify(res.body.data)).not.toMatch(/is_admin|"roles"|mfa_enabled/)
  })

  it('cleans up: unpublishes and trashes the project', async () => {
    await asOwner('POST', '/announcement/unpublish')
    expect((await call('DELETE', `/projects/${projectId}`, undefined, owner)).status).toBe(200)
  })
})
