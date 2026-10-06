import { useQueryClient, type QueryKey } from '@tanstack/react-query'

/**
 * The newest successfully loaded result among every cached query under `prefix`.
 *
 * When a filter change fails, the screen keeps showing the list it had (dimmed, under a banner) instead of going
 * blank. That list is already in the query cache, so it is read from there: no copy of server data in component state
 * (state rule S1) and no effect to keep a copy up to date.
 *
 *   const previous = useLastLoaded<ListResult>(qk.projects.lists)
 *   const data = query.data ?? (query.isError ? previous : undefined)
 *
 * It is a cache read at render time: it needs no subscription because it is only used while the current query has
 * failed, a moment at which the screen re-renders anyway.
 */
export function useLastLoaded<T>(prefix: QueryKey): T | undefined {
  const qc = useQueryClient()
  let newest: { at: number; data: unknown } | undefined
  for (const query of qc.getQueryCache().findAll({ queryKey: prefix })) {
    const { status, data, dataUpdatedAt } = query.state
    if (status === 'success' && data !== undefined && (!newest || dataUpdatedAt > newest.at)) {
      newest = { at: dataUpdatedAt, data }
    }
  }
  return newest?.data as T | undefined
}
