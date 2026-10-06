import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { StateBoundary } from '@/components/StateBoundary'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useAuth } from './authContext'

/** Signed-in users only. Anonymous visitors go to sign-in and come back afterwards. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <StateBoundary state="loading">{null}</StateBoundary>
  if (status === 'anonymous') {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}

/**
 * Researcher screens need an approved account (ACC-03). Everyone else is limited to the status
 * page. The backend must enforce the same rule (DEF-6); this guard is a courtesy, not security.
 */
export function RequireApproved() {
  const { isApproved } = useAuth()
  const location = useLocation()
  if (!isApproved) return <Navigate to="/status" replace state={{ blocked: location.pathname }} />
  return <Outlet />
}

/** Administration. Shows the same page as "not found" so the area's existence is not revealed. */
export function RequireAdmin() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <NotFoundPage />
  return <Outlet />
}
