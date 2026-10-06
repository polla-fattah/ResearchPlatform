import { useQueries } from '@tanstack/react-query'
import { listProjects } from '@/api/projects'
import { qk } from '@/api/queryKeys'

/** The projects the researcher can see (own and shared, not trashed), used to name exports and to pick what to export. */
export function useExportableProjects() {
  const lists = useQueries({
    queries: (['owned', 'shared'] as const).map((scope) => ({
      queryKey: qk.projects.list({ scope, per_page: 100 }),
      queryFn: ({ signal }: { signal: AbortSignal }) => listProjects({ scope, per_page: 100 }, signal),
    })),
  })
  const projects = lists
    .flatMap((l) => l.data?.items ?? [])
    .filter((p) => !p.is_deleted && !p.is_archived)
  const titles = new Map(lists.flatMap((l) => l.data?.items ?? []).map((p) => [p.id, p.title] as const))
  return {
    projects,
    titles,
    isPending: lists.some((l) => l.isPending),
    isError: lists.some((l) => l.isError),
  }
}
