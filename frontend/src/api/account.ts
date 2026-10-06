import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import {
  closeAccountSchema,
  mfaConfirmSchema,
  mfaDisableSchema,
  mfaEnrollSchema,
  notificationPreferencesSchema,
  savedProfileSchema,
  sessionSchema,
  type AccountDisplayPreferences,
  type NotificationPreferences,
} from './schemas/account'

const notKept = (what: string) =>
  new ApiError({ status: 200, code: 'NOT_PERSISTED', message: `The server did not keep the ${what}.`, details: { what } })

const sameList = (a: readonly string[] | null | undefined, b: readonly string[]) => (a ?? []).length === b.length && b.every((x, i) => (a ?? [])[i] === x)

// ── profile and display ───────────────────────────────────────────────────────────────────────────────────────
export interface ProfileChanges {
  display_name?: string
  preferred_language?: string
  affiliation?: string | null
  biography?: string | null
  research_interests?: string[]
  is_public?: boolean
  /** A list of field names: the public endpoint reads a list (request file C-10). */
  public_fields?: string[]
  display_preferences?: AccountDisplayPreferences
}

/**
 * Saves the profile or the display preferences. The server answers 200 for fields it did not store (the same defect as
 * library tags), so every field that was sent is compared with what came back and a difference is reported.
 */
export async function saveProfile(changes: ProfileChanges) {
  const { data } = await api('/auth/profile', { method: 'PATCH', body: changes, schema: savedProfileSchema })
  const p = data.profile
  const text = (v: string | null | undefined) => (v ?? '').trim()
  if (changes.display_name !== undefined && data.display_name !== changes.display_name) throw notKept('name')
  if (changes.preferred_language !== undefined && data.preferred_language !== changes.preferred_language) throw notKept('language')
  if (changes.affiliation !== undefined && text(p?.affiliation) !== text(changes.affiliation)) throw notKept('affiliation')
  if (changes.biography !== undefined && text(p?.biography) !== text(changes.biography)) throw notKept('biography')
  if (changes.research_interests !== undefined && !sameList(p?.research_interests, changes.research_interests)) throw notKept('interests')
  if (changes.is_public !== undefined && (p?.is_public ?? false) !== changes.is_public) throw notKept('visibility')
  if (changes.public_fields !== undefined) {
    const got = Array.isArray(p?.public_fields) ? p!.public_fields : Object.keys(p?.public_fields ?? {}).filter((k) => (p!.public_fields as Record<string, unknown>)[k])
    if (changes.public_fields.some((f) => !got.includes(f)) || got.some((f) => !changes.public_fields!.includes(f))) throw notKept('visible fields')
  }
  if (changes.display_preferences) {
    for (const [key, value] of Object.entries(changes.display_preferences)) {
      if ((p?.display_preferences as Record<string, unknown> | null | undefined)?.[key] !== value) throw notKept('display settings')
    }
  }
  return data
}

// ── password, sessions, two-step sign-in ──────────────────────────────────────────────────────────────────────
export async function changePassword(input: { current_password: string; password: string; password_confirmation: string }) {
  await api('/auth/password/change', { method: 'POST', body: input })
}

export async function listSessions(signal?: AbortSignal) {
  const { data } = await api('/auth/sessions', { schema: z.array(sessionSchema), signal })
  return data
}

export async function revokeSession(id: number) {
  await api(`/auth/sessions/${id}`, { method: 'DELETE' })
}

export async function revokeOtherSessions() {
  await api('/auth/sessions', { method: 'DELETE' })
}

/** Starts two-step sign-in: the secret to put in an authenticator app. Nothing is on until a code is confirmed. */
export async function startMfa() {
  const { data } = await api('/auth/mfa/enroll', { method: 'POST', schema: mfaEnrollSchema })
  return data
}

/** Confirms the first code. The recovery codes in the answer are shown once and cannot be read again. */
export async function confirmMfa(code: string) {
  const { data } = await api('/auth/mfa/confirm', { method: 'POST', body: { code }, schema: mfaConfirmSchema })
  if (!data.mfa_enabled) throw notKept('two-step sign-in')
  return data
}

export async function disableMfa(proof: { password: string } | { code: string }) {
  const { data } = await api('/auth/mfa/disable', { method: 'POST', body: proof, schema: mfaDisableSchema })
  if (data.mfa_enabled) throw notKept('change')
}

// ── notifications ─────────────────────────────────────────────────────────────────────────────────────────────
export async function getNotificationPreferences(signal?: AbortSignal) {
  const { data } = await api('/notifications/preferences', { schema: notificationPreferencesSchema, signal })
  return data
}

export async function saveNotificationPreferences(changes: Partial<NotificationPreferences>) {
  const { data } = await api('/notifications/preferences', { method: 'PATCH', body: changes, schema: notificationPreferencesSchema })
  for (const [key, value] of Object.entries(changes)) {
    if ((data as Record<string, unknown>)[key] !== value) throw notKept('notification settings')
  }
  return data
}

// ── closing the account ───────────────────────────────────────────────────────────────────────────────────────
export async function requestClosure(input: { password: string; reason?: string }) {
  const { data } = await api('/auth/account/close', {
    method: 'POST',
    body: { password: input.password, reason: input.reason || undefined },
    schema: closeAccountSchema,
  })
  if (data.status !== 'closure_requested') throw notKept('request')
  return data
}
