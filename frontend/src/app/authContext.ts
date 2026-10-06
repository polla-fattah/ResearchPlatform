import { createContext, useContext } from 'react'
import type { AccountStatus, Me } from '@/api/schemas/auth'

export interface AuthState {
  status: 'loading' | 'anonymous' | 'authenticated'
  user: Me | null
  accountStatus: AccountStatus | 'unknown' | null
  /** Approved and not suspended: allowed on researcher screens (ACC-03). */
  isApproved: boolean
  isAdmin: boolean
  /** Resolves with `mfa` when the account needs a second factor (not supported yet, request file C-4). */
  signIn: (email: string, password: string) => Promise<'session' | 'mfa'>
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
