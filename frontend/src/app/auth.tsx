import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from '@/api/auth'
import { ApiError } from '@/api/errors'
import { session } from '@/api/http'
import { asAccountStatus } from '@/api/schemas/auth'
import { AuthContext, type AuthState } from './authContext'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'


export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [hasToken, setHasToken] = useState(() => session.get() !== null)

  // A 401 on any authenticated request ends the session ("You were signed out").
  useEffect(() => {
    session.onUnauthenticated(() => {
      setHasToken(false)
      qc.clear()
    })
    return () => session.onUnauthenticated(null)
  }, [qc])

  const me = useQuery({
    queryKey: qk.auth.me,
    queryFn: ({ signal }) => authApi.fetchMe(signal),
    enabled: hasToken,
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 1,
    staleTime: 60_000,
  })

  const startSession = useCallback(
    async (token: string) => {
      session.set(token)
      setHasToken(true)
      await invalidate.me(qc)
    },
    [qc],
  )

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password)
      if (result.kind === 'mfa') return { kind: 'mfa', challengeToken: result.challengeToken } as const
      await startSession(result.token)
      return { kind: 'session' } as const
    },
    [startSession],
  )

  const completeMfa = useCallback(
    async (challengeToken: string, code: string) => {
      await startSession(await authApi.completeMfa(challengeToken, code))
    },
    [startSession],
  )

  const signOut = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      /* the local session ends either way */
    }
    session.set(null)
    setHasToken(false)
    qc.clear()
  }, [qc])

  const value = useMemo<AuthState>(() => {
    const user = hasToken ? (me.data ?? null) : null
    const status: AuthState['status'] = !hasToken
      ? 'anonymous'
      : me.isPending
        ? 'loading'
        : user
          ? 'authenticated'
          : 'anonymous'
    const accountStatus = user ? asAccountStatus(user.status) : null
    return {
      status,
      user,
      accountStatus,
      isApproved: accountStatus === 'approved',
      isAdmin: user?.is_admin === true,
      signIn,
      completeMfa,
      startSession,
      signOut,
    }
  }, [hasToken, me.data, me.isPending, signIn, completeMfa, startSession, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
