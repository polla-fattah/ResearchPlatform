import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { meSchema } from '@/api/schemas/auth'
import {
  closeAccountSchema,
  mfaConfirmSchema,
  mfaEnrollSchema,
  notificationPreferencesSchema,
  savedProfileSchema,
  sessionSchema,
} from '@/api/schemas/account'
import { z } from 'zod'

/**
 * Contract test for the account's own settings (screen 14): profile and public visibility, display preferences, password,
 * sessions, two-step sign-in (with real TOTP codes), notification preferences and the closure request. It creates one
 * throwaway researcher through the application workflow (an administrator stands in for email verification, which does
 * not work, request file C-20) and leaves it as a declined account. Opt-in for the write part:
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

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) from the base32 secret the server hands out. */
function totp(secret: string, offsetSteps = 0): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const ch of secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0')
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offsetSteps))
  const hmac = createHmac('sha1', key).update(counter).digest()
  const at = hmac[hmac.length - 1]! & 0xf
  const num = ((hmac[at]! & 0x7f) << 24) | (hmac[at + 1]! << 16) | (hmac[at + 2]! << 8) | hmac[at + 3]!
  return String(num % 1_000_000).padStart(6, '0')
}

describe.skipIf(!reachable || !EMAIL || !PASSWORD)(`account, read (${BASE})`, () => {
  it('reads the account with its profile, display preferences and counts, and the notification preferences', async () => {
    const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })
    const token = login.body.data.token
    const me = meSchema.parse((await call('GET', '/auth/me', undefined, token)).body.data)
    expect(me.display_preferences).toBeTruthy()
    z.array(sessionSchema).parse((await call('GET', '/auth/sessions', undefined, token)).body.data)
    notificationPreferencesSchema.parse((await call('GET', '/notifications/preferences', undefined, token)).body.data)
  })
})

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`account, write (${BASE})`, () => {
  const stamp = Date.now()
  const email = `contract-${stamp}@example.test`
  let admin = ''
  let userId = 0
  let token = ''
  let password = 'password123'

  const as = (method: string, path: string, body?: unknown) => call(method, path, body, token)

  it('creates a throwaway researcher through the application workflow', async () => {
    admin = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    const applied = await call('POST', '/applications', {
      display_name: `[contract-test] account ${stamp}`,
      email,
      password,
      password_confirmation: password,
      research_interests: 'Contract testing',
      preferred_language: 'en',
    })
    expect(applied.status).toBe(201)
    userId = applied.body.data.user.id
    const applicationId = applied.body.data.application.id
    await call('PATCH', `/admin/users/${userId}/status`, { status: 'pending', reason: 'Contract test: stand in for email verification' }, admin)
    await call('POST', `/admin/applications/${applicationId}/decide`, { decision: 'approved', decision_reason: 'Contract test account' }, admin)
    token = (await call('POST', '/auth/login', { email, password })).body.data.token
    expect(token).toBeTruthy()
  })

  it('answers /auth/me with the profile and display preferences, and defaults for preferences never set', async () => {
    const me = meSchema.parse((await as('GET', '/auth/me')).body.data)
    expect(me.profile?.is_public).toBe(false)
    expect(me.display_preferences).toMatchObject({ numerals: 'eastern_arabic', calendar: 'gregorian_hijri', time_zone: 'UTC' })
    const raw = (await as('GET', '/auth/me')).body.data
    expect(raw.profile.display_preferences).toBeNull()
  })

  it('saves the profile and reads every field back', async () => {
    const res = await as('PATCH', '/auth/profile', {
      display_name: `[contract-test] account ${stamp} (edited)`,
      affiliation: 'Contract University',
      biography: 'Studies the transmission of early reports.',
      research_interests: ['Isnād', 'Matn variation'],
    })
    expect(res.status).toBe(200)
    const saved = savedProfileSchema.parse(res.body.data)
    expect(saved.display_name).toContain('(edited)')
    expect(saved.profile).toMatchObject({ affiliation: 'Contract University', research_interests: ['Isnād', 'Matn variation'] })
    const me = meSchema.parse((await as('GET', '/auth/me')).body.data)
    expect(me.profile?.biography).toBe('Studies the transmission of early reports.')
  })

  it('makes the profile public with the listed fields only, and the public page shows exactly those', async () => {
    const res = await as('PATCH', '/auth/profile', { is_public: true, public_fields: ['affiliation', 'research_interests'] })
    expect(res.status).toBe(200)
    const pub = await call('GET', `/public/researchers/${userId}`)
    expect(pub.status).toBe(200)
    expect(pub.body.data).toMatchObject({ affiliation: 'Contract University', research_interests: ['Isnād', 'Matn variation'], biography: null, email: null })
    await as('PATCH', '/auth/profile', { is_public: false })
    expect((await call('GET', `/public/researchers/${userId}`)).status).toBe(404)
  })

  it('stores display preferences and refuses values it does not know', async () => {
    const ok = await as('PATCH', '/auth/profile', { display_preferences: { default_content_language: 'ckb', numerals: 'western', calendar: 'gregorian', time_zone: 'Asia/Baghdad' } })
    expect(ok.status).toBe(200)
    const me = meSchema.parse((await as('GET', '/auth/me')).body.data)
    expect(me.display_preferences).toMatchObject({ default_content_language: 'ckb', numerals: 'western', calendar: 'gregorian', time_zone: 'Asia/Baghdad' })
    expect((await as('PATCH', '/auth/profile', { display_preferences: { numerals: 'roman' } })).status).toBe(422)
    expect((await as('PATCH', '/auth/profile', { preferred_language: 'fr' })).status).toBe(422)
    expect((await as('PATCH', '/auth/profile', { preferred_language: 'ckb' })).status).toBe(200)
    expect(meSchema.parse((await as('GET', '/auth/me')).body.data).preferred_language).toBe('ckb')
  })

  it('changes the password only with the right current password, a new one of eight characters, and a matching confirmation', async () => {
    const wrong = await as('POST', '/auth/password/change', { current_password: 'nope', password: 'newpassword1', password_confirmation: 'newpassword1' })
    expect(wrong.status).toBe(422)
    expect(wrong.body.error.details).toHaveProperty('current_password')
    expect((await as('POST', '/auth/password/change', { current_password: password, password: 'short', password_confirmation: 'short' })).status).toBe(422)
    expect((await as('POST', '/auth/password/change', { current_password: password, password: 'newpassword1', password_confirmation: 'different1' })).status).toBe(422)
    expect((await as('POST', '/auth/password/change', { current_password: password, password: 'newpassword1', password_confirmation: 'newpassword1' })).status).toBe(200)
    expect((await call('POST', '/auth/login', { email, password })).status).toBe(401)
    password = 'newpassword1'
    token = (await call('POST', '/auth/login', { email, password })).body.data.token
    expect(token).toBeTruthy()
  })

  it('lists the sessions with the current one marked, and ends another without ending this one', async () => {
    const other = (await call('POST', '/auth/login', { email, password })).body.data.token
    const sessions = z.array(sessionSchema).parse((await as('GET', '/auth/sessions')).body.data)
    expect(sessions.filter((s) => s.current)).toHaveLength(1)
    expect(sessions.length).toBeGreaterThanOrEqual(2)
    const otherId = sessions.find((s) => !s.current)!.id
    expect((await as('DELETE', `/auth/sessions/${otherId}`)).status).toBe(200)
    const after = z.array(sessionSchema).parse((await as('GET', '/auth/sessions')).body.data)
    expect(after.some((s) => s.id === otherId)).toBe(false)
    expect((await as('GET', '/auth/me')).status).toBe(200)
    void other
  })

  it('ends every other session at once', async () => {
    await call('POST', '/auth/login', { email, password })
    await call('POST', '/auth/login', { email, password })
    expect((await as('DELETE', '/auth/sessions')).status).toBe(200)
    const sessions = z.array(sessionSchema).parse((await as('GET', '/auth/sessions')).body.data)
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.current).toBe(true)
  })

  it('does not let one researcher end another’s session', async () => {
    const mine = z.array(sessionSchema).parse((await call('GET', '/auth/sessions', undefined, admin)).body.data)
    expect((await as('DELETE', `/auth/sessions/${mine[0]!.id}`)).status).toBe(200)
    expect((await call('GET', '/auth/me', undefined, admin)).status).toBe(200)
  })

  it('turns on two-step sign-in with a real code, hands out recovery codes once, and requires the second step to sign in', async () => {
    const enroll = mfaEnrollSchema.parse((await as('POST', '/auth/mfa/enroll')).body.data)
    expect(enroll.otpauth_url).toContain(enroll.secret)
    expect((await as('POST', '/auth/mfa/confirm', { code: '000000' })).status).toBe(422)
    const confirmed = mfaConfirmSchema.parse((await as('POST', '/auth/mfa/confirm', { code: totp(enroll.secret) })).body.data)
    expect(confirmed.recovery_codes).toHaveLength(5)
    expect(meSchema.parse((await as('GET', '/auth/me')).body.data).mfa_enabled).toBe(true)

    const first = await call('POST', '/auth/login', { email, password })
    expect(first.body.data.mfa_required).toBe(true)
    expect((await call('POST', '/auth/mfa/challenge', { challenge_token: first.body.data.challenge_token, code: '000000' })).status).toBe(401)
    const withCode = await call('POST', '/auth/mfa/challenge', { challenge_token: first.body.data.challenge_token, code: totp(enroll.secret) })
    expect(withCode.status).toBe(200)
    expect(withCode.body.data.token).toBeTruthy()

    const second = await call('POST', '/auth/login', { email, password })
    const withRecovery = await call('POST', '/auth/mfa/challenge', { challenge_token: second.body.data.challenge_token, code: confirmed.recovery_codes[0] })
    expect(withRecovery.status).toBe(200)
    const third = await call('POST', '/auth/login', { email, password })
    expect((await call('POST', '/auth/mfa/challenge', { challenge_token: third.body.data.challenge_token, code: confirmed.recovery_codes[0] })).status).toBe(401)
  })

  it('does not let a six-digit code be used twice', async () => {
    const secret = (await as('POST', '/auth/mfa/enroll')).body.data.secret as string
    // Enrolling again replaced the secret; the account is already on, so confirm with the new one to keep it consistent.
    expect((await as('POST', '/auth/mfa/confirm', { code: totp(secret) })).status).toBe(200)
    const code = totp(secret)
    const a = await call('POST', '/auth/login', { email, password })
    expect((await call('POST', '/auth/mfa/challenge', { challenge_token: a.body.data.challenge_token, code })).status).toBe(200)
    const b = await call('POST', '/auth/login', { email, password })
    expect((await call('POST', '/auth/mfa/challenge', { challenge_token: b.body.data.challenge_token, code })).status).toBe(401)
  })

  it('turns two-step sign-in off with the password, and refuses a wrong one', async () => {
    expect((await as('POST', '/auth/mfa/disable', { password: 'wrong password' })).status).toBe(422)
    expect(meSchema.parse((await as('GET', '/auth/me')).body.data).mfa_enabled).toBe(true)
    expect((await as('POST', '/auth/mfa/disable', { password })).status).toBe(200)
    expect(meSchema.parse((await as('GET', '/auth/me')).body.data).mfa_enabled).toBe(false)
    const login = await call('POST', '/auth/login', { email, password })
    expect(login.body.data.token).toBeTruthy()
    token = login.body.data.token
  })

  it('reads notification preferences, saves one change, and refuses a digest it does not know', async () => {
    const before = notificationPreferencesSchema.parse((await as('GET', '/notifications/preferences')).body.data)
    expect(before.notify_exports).toBe(true)
    expect((await as('PATCH', '/notifications/preferences', { notify_exports: false, email_digest: 'daily' })).status).toBe(200)
    const after = notificationPreferencesSchema.parse((await as('GET', '/notifications/preferences')).body.data)
    expect(after).toMatchObject({ notify_exports: false, email_digest: 'daily', notify_search_runs: true })
    expect((await as('PATCH', '/notifications/preferences', { email_digest: 'hourly' })).status).toBe(422)
  })

  it('requests closure with the password, and an administrator sees and declines it', async () => {
    expect((await as('POST', '/auth/account/close', { password: 'wrong password' })).status).toBe(422)
    const res = await as('POST', '/auth/account/close', { password, reason: 'Contract test' })
    expect(res.status).toBe(200)
    expect(closeAccountSchema.parse(res.body.data).status).toBe('closure_requested')
    expect(meSchema.parse((await as('GET', '/auth/me')).body.data).status).toBe('closure_requested')
    const queue = (await call('GET', '/admin/closures', undefined, admin)).body.data as { id: number }[]
    expect(queue.some((c) => c.id === userId)).toBe(true)
    expect((await call('POST', `/admin/closures/${userId}/decide`, { decision: 'rejected' }, admin)).status).toBe(200)
    expect(meSchema.parse((await as('GET', '/auth/me')).body.data).status).toBe('approved')
  })

  it('C-21: the password change ends the other sessions', async () => {
    const other = (await call('POST', '/auth/login', { email, password })).body.data.token
    expect((await as('POST', '/auth/password/change', { current_password: password, password: 'thirdpassword1', password_confirmation: 'thirdpassword1' })).status).toBe(200)
    password = 'thirdpassword1'
    expect((await call('GET', '/auth/me', undefined, other)).status).toBe(401)
  })

  it.fails('C-21: a session says which device it is', async () => {
    const sessions = z.array(sessionSchema).parse((await as('GET', '/auth/sessions')).body.data)
    expect(sessions.every((s) => s.device && s.device !== 'Web Browser')).toBe(true)
  })

  it.fails('C-21: the account answers how many recovery codes are left', async () => {
    const me = (await as('GET', '/auth/me')).body.data
    expect(me).toHaveProperty('recovery_codes_remaining')
  })

  it.fails('C-21: the closure request keeps the reason the researcher gave and when it was made', async () => {
    expect((await as('POST', '/auth/account/close', { password, reason: 'Second contract reason' })).status).toBe(200)
    const queue = (await call('GET', '/admin/closures', undefined, admin)).body.data as { id: number; closure_reason: string | null; closure_requested_at: string | null }[]
    const mine = queue.find((c) => c.id === userId)!
    await call('POST', `/admin/closures/${userId}/decide`, { decision: 'rejected' }, admin)
    expect(mine.closure_reason).toBe('Second contract reason')
    expect(mine.closure_requested_at).toBeTruthy()
  })

  it('C-21: a researcher can see the support access they have given', async () => {
    const res = await as('GET', '/researcher/support-grants')
    expect(res.status).toBe(200)
  })

  it('cleans up: ends the sessions and leaves the researcher as a declined account', async () => {
    const res = await call('PATCH', `/admin/users/${userId}/status`, { status: 'rejected', reason: 'Contract test finished' }, admin)
    expect(res.status).toBe(200)
  })
})
