import { useQuery } from '@tanstack/react-query'
import { countApplications, countProposals, countUsers, getOps, listSupportGrants } from '@/api/admin'
import { qk } from '@/api/queryKeys'
import { useNow } from '@/hooks/useNow'
import { grantState } from './adminModel'

/**
 * The numbers beside the administration navigation. Each one is its own request, so a number that fails to load is
 * left out (undefined) and never blocks the page; they refresh with the screen they belong to.
 */
export function useAdminCounts() {
  const now = useNow()
  const waiting = useQuery({ queryKey: qk.admin.count('applications:pending'), queryFn: ({ signal }) => countApplications('pending', signal) })
  const accounts = useQuery({ queryKey: qk.admin.count('accounts'), queryFn: ({ signal }) => countUsers(undefined, signal) })
  const proposals = useQuery({ queryKey: qk.admin.count('proposals'), queryFn: ({ signal }) => countProposals('submitted', signal) })
  const grants = useQuery({ queryKey: qk.admin.grants, queryFn: ({ signal }) => listSupportGrants(signal) })
  const ops = useQuery({ queryKey: qk.admin.ops, queryFn: ({ signal }) => getOps(signal) })

  return {
    applications: waiting.data,
    accounts: accounts.data,
    proposals: proposals.data,
    support: grants.data?.filter((g) => grantState(g, now).state === 'active').length,
    alerts: ops.data?.active_alerts.length,
  }
}
