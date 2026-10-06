import { z } from 'zod'
import { api } from './http'
import {
  loginResultSchema,
  meSchema,
  registerResultSchema,
  sessionResultSchema,
  type Me,
  type RegisterInput,
} from './schemas/auth'
import { resendResultSchema } from './schemas/application'

export type LoginResult =
  | { kind: 'session'; token: string }
  | { kind: 'mfa'; challengeToken: string }

export async function login(email: string, password: string): Promise<LoginResult> {
  const { data } = await api('/auth/login', {
    method: 'POST',
    body: { email, password },
    schema: loginResultSchema,
  })
  if ('mfa_required' in data) return { kind: 'mfa', challengeToken: data.challenge_token }
  return { kind: 'session', token: data.token }
}

/** The second step of sign-in when the account has two-step sign-in on: the 6-digit code, or a single-use recovery code. */
export async function completeMfa(challengeToken: string, code: string): Promise<string> {
  const { data } = await api('/auth/mfa/challenge', {
    method: 'POST',
    body: { challenge_token: challengeToken, code },
    schema: sessionResultSchema,
  })
  return data.token
}

export async function register(input: RegisterInput) {
  const { data } = await api('/auth/register', {
    method: 'POST',
    body: input,
    schema: registerResultSchema,
  })
  return data
}

export async function fetchMe(signal?: AbortSignal): Promise<Me> {
  const { data } = await api('/auth/me', { schema: meSchema, signal })
  return data
}

export async function logout(): Promise<void> {
  await api('/auth/logout', { method: 'POST' })
}

/** Single-use link: a second call with the same token answers 410 GONE. */
export async function verifyEmail(token: string): Promise<void> {
  await api('/auth/email/verify', { method: 'POST', body: { token } })
}

/** Limits: 1 per minute and 5 per day (429 with retry_after in the details). */
export async function resendVerification(email: string) {
  const { data } = await api('/auth/email/resend', {
    method: 'POST',
    body: { email },
    schema: resendResultSchema,
  })
  return data
}

/** Always succeeds for any address, so it never reveals whether an account exists. */
export async function forgotPassword(email: string): Promise<void> {
  await api('/auth/password/forgot', { method: 'POST', body: { email }, schema: z.null().optional() })
}

export async function resetPassword(input: {
  email: string
  token: string
  password: string
  password_confirmation: string
}): Promise<void> {
  await api('/auth/password/reset', { method: 'POST', body: input })
}
