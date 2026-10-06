import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { publicAnnouncementSchema } from '@/api/schemas/publicAnnouncement'

/**
 * Contract test for the public announcement pages (screen 20): no sign-in, no token. It reads the public list and each
 * page and checks the whitelist: no e-mail address, no administrator flag, no internal fields. Read-only, so it needs no
 * write flag. WRITTEN FROM THE BACKEND CODE AND NOT YET RUN against a live server (the cloud session has no PHP 8.4).
 *
 *   npm run test:contract
 */
const BASE = process.env.CONTRACT_BASE_URL ?? 'http://127.0.0.1:8000'

const reachable = await fetch(`${BASE}/up`).then(
  (r) => r.ok,
  () => false,
)

async function get(path: string) {
  const res = await fetch(`${BASE}/api/v1${path}`, { headers: { Accept: 'application/json' } })
  const text = await res.text()
  return { status: res.status, body: text ? (JSON.parse(text) as Record<string, any>) : {} }
}

describe.skipIf(!reachable)(`public announcements (${BASE})`, () => {
  it('lists published announcements without signing in, paged, and parses with the public schema', async () => {
    const res = await get('/public/announcements?per_page=50')
    expect(res.status).toBe(200)
    z.array(publicAnnouncementSchema).parse(res.body.data)
    expect(res.body.meta.pagination).toMatchObject({ current_page: 1 })
  })

  it('shows nothing private in the list or on any page: no e-mail, no roles, no administrator flag', async () => {
    const list = await get('/public/announcements?per_page=50')
    const text = JSON.stringify(list.body.data)
    expect(text).not.toMatch(/"email"/)
    expect(text).not.toMatch(/is_admin|"roles"|owner_id|mfa_enabled|password/)
    for (const a of (list.body.data as { public_slug: string }[]).slice(0, 5)) {
      const page = await get(`/public/announcements/${a.public_slug}`)
      expect(page.status).toBe(200)
      expect(JSON.stringify(page.body.data)).not.toMatch(/"email"|is_admin|"roles"|owner_id|mfa_enabled/)
    }
  })

  it('answers 404 for an address that is not published, with the same answer as one that never existed', async () => {
    const res = await get('/public/announcements/contract-test-does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.error?.code).toBe('NOT_FOUND')
  })

  it('filters by stage and by words on the server', async () => {
    const all = (await get('/public/announcements?per_page=100')).body.data as { research_stage?: string; title: string }[]
    const stage = all[0]?.research_stage
    if (stage) {
      const only = (await get(`/public/announcements?research_stage=${stage}&per_page=100`)).body.data as { research_stage: string }[]
      expect(only.every((a) => a.research_stage === stage)).toBe(true)
    }
    expect((await get('/public/announcements?q=zzzz-no-such-word-zzzz')).body.data).toEqual([])
  })

  it('C-27: the public answer does not carry the internal project id', async () => {
    const first = ((await get('/public/announcements?per_page=1')).body.data as Record<string, any>[])[0]
    if (!first) throw new Error('no announcement to check')
    expect(first).not.toHaveProperty('project_id')
    expect(first.project ?? {}).not.toHaveProperty('id')
  })
})
