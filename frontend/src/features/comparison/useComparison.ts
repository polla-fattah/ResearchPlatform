import { useQueries, useQuery } from '@tanstack/react-query'
import { compareIsnads, compareMatn, criticismMatrix, getAnalysis, listAnalyses } from '@/api/analyses'
import { getHadith } from '@/api/corpus'
import { ApiError } from '@/api/errors'
import { qk } from '@/api/queryKeys'
import type { CorpusHadith } from '@/api/schemas/corpus'
import { chainSources, MAX_CHAINS, MIN_REPORTS, sortRuns } from './comparisonModel'

/** The project's stored analyses, newest first. */
export function useRuns(projectId: number) {
  return useQuery({
    queryKey: qk.project(projectId).analyses.list,
    queryFn: ({ signal }) => listAnalyses(projectId, signal),
    select: sortRuns,
  })
}

/** One stored analysis. A 404 (not here, or not in this project) is the same answer whichever it is. */
export function useRun(projectId: number, id: number | undefined) {
  return useQuery({
    queryKey: qk.project(projectId).analyses.detail(id ?? 0),
    queryFn: ({ signal }) => getAnalysis(projectId, id!, signal),
    enabled: id !== undefined,
    retry: false,
  })
}

export interface LoadedReports {
  reports: CorpusHadith[]
  /** Ids the corpus does not have (the server would drop them without saying). */
  missing: number[]
  pending: boolean
  failed: boolean
}

/** The corpus record of each compared report, in the order they were picked. Cached with the evidence inspector's. */
export function useReports(ids: readonly number[]): LoadedReports {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: qk.corpus.hadith(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => getHadith(id, signal),
      retry: (count: number, error: unknown) => !(error instanceof ApiError && error.status === 404) && count < 2,
    })),
    combine: (results) => ({
      reports: results.flatMap((r) => (r.data ? [r.data] : [])),
      missing: ids.filter((_, i) => results[i]?.error instanceof ApiError && results[i]?.error?.status === 404),
      pending: results.some((r) => r.isPending),
      failed: results.some((r) => r.isError && !(r.error instanceof ApiError && r.error.status === 404)),
    }),
  })
}

/** Compares the wording of reports. Computing stores nothing, so it is a query keyed by its inputs. */
export function useMatnCompare(projectId: number, hadithIds: readonly number[], baseline: number | undefined) {
  const inputs = {
    hadith_ids: [...hadithIds],
    ...(baseline && hadithIds.includes(baseline) ? { baseline_id: baseline } : {}),
  }
  return useQuery({
    queryKey: qk.project(projectId).compare.matn(inputs),
    queryFn: ({ signal }) => compareMatn(projectId, inputs, false, signal).then((r) => r.result),
    enabled: hadithIds.length >= MIN_REPORTS,
    retry: false,
    staleTime: Infinity,
  })
}

export function useIsnadCompare(projectId: number, sanadIds: readonly number[]) {
  return useQuery({
    queryKey: qk.project(projectId).compare.isnads(sanadIds),
    queryFn: ({ signal }) => compareIsnads(projectId, [...sanadIds], false, signal).then((r) => r.result),
    enabled: sanadIds.length >= 2,
    retry: false,
    staleTime: Infinity,
  })
}

export function useCriticismMatrix(projectId: number, narratorIds: readonly number[]) {
  return useQuery({
    queryKey: qk.project(projectId).compare.criticism(narratorIds),
    queryFn: ({ signal }) => criticismMatrix(projectId, [...narratorIds], false, signal).then((r) => r.result),
    enabled: narratorIds.length >= 1,
    retry: false,
    staleTime: Infinity,
  })
}

/** The chains of the picked reports (the first few), compared. Shared by the Chains view and the narrator dossier. */
export function useChainsOfReports(projectId: number, reportIds: readonly number[]) {
  const loaded = useReports(reportIds)
  const sources = chainSources(loaded.reports)
  const shown = sources.slice(0, MAX_CHAINS)
  const compare = useIsnadCompare(
    projectId,
    shown.map((s) => s.sanadId),
  )
  return { loaded, sources, shown, compare }
}
