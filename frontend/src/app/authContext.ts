import { createContext, useContext } from 'react'
import type { AccountStatus, Me } from '@/api/schemas/auth'

export type SignInOutcome = { kind: 'session' } | { kind: 'mfa'; challengeToken: string }

export interface AuthState {
  status: 'loading' | 'anonymous' | 'authenticated'
  user: Me | null
  accountStatus: AccountStatus | 'unknown' | null
  /** Approved and not suspended: allowed on researcher screens (ACC-03). */
  isApproved: boolean
  isAdmin: boolean
  /** Resolves with `mfa` and a challenge when the account needs a second factor; `completeMfa` finishes the sign-in. */
  signIn: (email: string, password: string) => Promise<SignInOutcome>
  completeMfa: (challengeToken: string, code: string) => Promise<void>
  /** Adopts a token obtained elsewhere, e.g. from the apply call. */
  startSession: (token: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
