import { QueryClient, type QueryKey } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { invalidate } from './invalidate'
import { qk } from './queryKeys'

/** A client with one cached query per key, so we can see exactly which ones an invalidator marks stale. */
function seed(keys: Record<string, QueryKey>) {
  const qc = new QueryClient()
  for (const key of Object.values(keys)) qc.setQueryData(key, 'cached')
  const stale = (name: string) => qc.getQueryState(keys[name]!)?.isInvalidated === true
  return { qc, stale }
}

const P = 12
const OTHER = 99

const keys = {
  list: qk.projects.list({ scope: 'owned' }),
  detail: qk.project(P).detail,
  summary: qk.project(P).summary,
  milestones: qk.project(P).milestones,
  questions: qk.project(P).questions,
  resources: qk.project(P).resources.list(1),
  resourceCollections: qk.project(P).resources.collections,
  evidenceList: qk.project(P).evidence.list({ state: 'included' }),
  evidenceItem: qk.project(P).evidence.item(7),
  evidenceItemOther: qk.project(P).evidence.item(8),
  evidenceDeps: qk.project(P).evidence.deps(7),
  findings: qk.project(P).findings.list(),
  searchQueries: qk.project(P).search.queries,
  searchRuns: qk.project(P).search.runs,
  otherProjectSummary: qk.project(OTHER).summary,
  otherProjectEvidence: qk.project(OTHER).evidence.list({}),
  library: qk.library.list({}),
  libraryIndex: qk.library.index,
  exportsList: qk.exports.list(1),
  corpus: qk.corpus.hadith(1),
  me: qk.auth.me,
  application: qk.application.status,
}

describe('query keys', () => {
  it('keep every piece of one project under one prefix, and never under another project', () => {
    const all = [
      qk.project(P).detail,
      qk.project(P).resources.all,
      qk.project(P).evidence.all,
      qk.project(P).search.all,
      qk.project(P).findings.all,
      qk.project(P).documents.all,
      qk.project(P).analyses.all,
    ]
    for (const key of all) expect(key.slice(0, 2)).toEqual(['projects', P])
    expect(qk.project(OTHER).evidence.all.slice(0, 2)).toEqual(['projects', OTHER])
  })

  it('make the project lists a different branch from any project, so one cannot hide in the other', () => {
    expect(qk.projects.list({}).slice(0, 2)).toEqual(['projects', 'list'])
    expect(typeof qk.project(P).root[1]).toBe('number')
  })
})

describe('invalidate', () => {
  it('evidenceChanged refreshes the evidence, the summary counts and the project lists of that project only', () => {
    const { qc, stale } = seed(keys)
    void invalidate.evidenceChanged(qc, P)
    for (const k of ['evidenceList', 'evidenceItem', 'evidenceDeps', 'summary', 'list']) expect(stale(k), k).toBe(true)
    for (const k of ['otherProjectSummary', 'otherProjectEvidence', 'library', 'resources', 'detail']) expect(stale(k), k).toBe(false)
  })

  it('annotationsChanged refreshes only the one evidence item', () => {
    const { qc, stale } = seed(keys)
    void invalidate.annotationsChanged(qc, P, 7)
    expect(stale('evidenceItem')).toBe(true)
    for (const k of ['evidenceItemOther', 'evidenceList', 'summary']) expect(stale(k), k).toBe(false)
  })

  it('evidenceLinksChanged refreshes that item’s dependencies and the findings', () => {
    const { qc, stale } = seed(keys)
    void invalidate.evidenceLinksChanged(qc, P, 7)
    for (const k of ['evidenceDeps', 'findings', 'summary']) expect(stale(k), k).toBe(true)
    expect(stale('evidenceItem')).toBe(false)
  })

  it('resourcesChanged refreshes resources (and their collections), the summary and the lists, not evidence', () => {
    const { qc, stale } = seed(keys)
    void invalidate.resourcesChanged(qc, P)
    for (const k of ['resources', 'resourceCollections', 'summary', 'list']) expect(stale(k), k).toBe(true)
    for (const k of ['evidenceList', 'otherProjectSummary']) expect(stale(k), k).toBe(false)
  })

  it('projectEdited refreshes the project, its summary and the lists, not its evidence', () => {
    const { qc, stale } = seed(keys)
    void invalidate.projectEdited(qc, P)
    for (const k of ['detail', 'summary', 'list']) expect(stale(k), k).toBe(true)
    expect(stale('evidenceList')).toBe(false)
  })

  it('projectLifecycle refreshes every project list and every project, but not the library or the corpus', () => {
    const { qc, stale } = seed(keys)
    void invalidate.projectLifecycle(qc)
    for (const k of ['list', 'detail', 'summary', 'evidenceList', 'otherProjectSummary', 'otherProjectEvidence']) expect(stale(k), k).toBe(true)
    for (const k of ['library', 'corpus', 'exportsList', 'me']) expect(stale(k), k).toBe(false)
  })

  it('searchChanged, milestonesChanged and questionsChanged stay inside their own area', () => {
    const a = seed(keys)
    void invalidate.searchChanged(a.qc, P)
    for (const k of ['searchQueries', 'searchRuns', 'summary']) expect(a.stale(k), k).toBe(true)
    expect(a.stale('evidenceList')).toBe(false)

    const b = seed(keys)
    void invalidate.milestonesChanged(b.qc, P)
    expect(b.stale('milestones')).toBe(true)
    expect(b.stale('questions')).toBe(false)

    const c = seed(keys)
    void invalidate.questionsChanged(c.qc, P)
    expect(c.stale('questions')).toBe(true)
    expect(c.stale('milestones')).toBe(false)
  })

  it('libraryChanged refreshes every library query and nothing else; exportsChanged the exports', () => {
    const a = seed(keys)
    void invalidate.libraryChanged(a.qc)
    for (const k of ['library', 'libraryIndex']) expect(a.stale(k), k).toBe(true)
    for (const k of ['resources', 'list', 'exportsList']) expect(a.stale(k), k).toBe(false)

    const b = seed(keys)
    void invalidate.exportsChanged(b.qc)
    expect(b.stale('exportsList')).toBe(true)
    expect(b.stale('library')).toBe(false)
  })

  it('me and applicationStatus refresh the account queries', () => {
    const a = seed(keys)
    void invalidate.me(a.qc)
    expect(a.stale('me')).toBe(true)
    expect(a.stale('application')).toBe(false)
    const b = seed(keys)
    void invalidate.applicationStatus(b.qc)
    expect(b.stale('application')).toBe(true)
  })
})
