import type { CorpusSearchParams } from './corpus'
import type { EvidenceQuery } from './evidence'
import type { ExportRequest } from './exports'
import type { LibraryQuery } from './libraryManage'
import type { ListProjectsParams } from './projects'
import type { ShareOptions } from './schemas/library'

/**
 * Every TanStack Query key in the app, in one place (state rule S5).
 *
 * Keys are hierarchical: a key is a prefix of every key beneath it, so invalidating a parent invalidates its children.
 *   ['projects', 'list', params]            the project lists (index, home cards, pickers)
 *   ['projects', <id>, <area>, ...]         everything that belongs to one project, one area per feature
 *   ['library', ...] ['corpus', ...] ['exports', ...] ['home', ...]
 *
 * Components never write key arrays by hand and never call `invalidateQueries` with one: they call a named invalidator
 * from `invalidate.ts`, which knows everything a given write affects.
 */
export const qk = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  /** The signed-in person's own settings (screen 14). */
  account: {
    sessions: ['account', 'sessions'] as const,
    notifications: ['account', 'notifications'] as const,
  },
  application: {
    status: ['application', 'my-status'] as const,
  },
  verifyEmail: (token: string) => ['verify-email', token] as const,

  home: {
    exports: ['home', 'exports'] as const,
    openTasks: ['home', 'open-tasks'] as const,
    unread: ['home', 'unread'] as const,
  },

  projects: {
    /** Every project list and every project's data. Only for create, trash, restore and leave. */
    root: ['projects'] as const,
    lists: ['projects', 'list'] as const,
    list: (params: ListProjectsParams) => ['projects', 'list', params] as const,
  },

  /** Everything that belongs to one project. */
  project: (id: number) => {
    const root = ['projects', id] as const
    return {
      root,
      detail: [...root, 'detail'] as const,
      summary: [...root, 'summary'] as const,
      milestones: [...root, 'milestones'] as const,
      questions: [...root, 'questions'] as const,
      copyPicker: (kind: string) => [...root, 'copy-picker', kind] as const,
      copyPreview: (targetId: number | null, items: unknown) => [...root, 'copy-preview', targetId, items] as const,

      resources: {
        all: [...root, 'resources'] as const,
        list: (page: number) => [...root, 'resources', 'list', page] as const,
        collections: [...root, 'resources', 'collections'] as const,
      },
      evidence: {
        all: [...root, 'evidence'] as const,
        list: (query: EvidenceQuery) => [...root, 'evidence', 'list', query] as const,
        item: (evidenceId: number) => [...root, 'evidence', 'item', evidenceId] as const,
        history: (evidenceId: number) => [...root, 'evidence', 'history', evidenceId] as const,
        deps: (evidenceId: number) => [...root, 'evidence', 'deps', evidenceId] as const,
        findingOptions: [...root, 'evidence', 'finding-options'] as const,
      },
      search: {
        all: [...root, 'search'] as const,
        queries: [...root, 'search', 'queries'] as const,
        runs: [...root, 'search', 'runs'] as const,
        resultSets: [...root, 'search', 'result-sets'] as const,
        compare: (a: number, b: number) => [...root, 'search', 'compare', a, b] as const,
      },
      findings: {
        all: [...root, 'findings'] as const,
        list: (query?: { status?: string; q?: string; page?: number }) => [...root, 'findings', 'list', query] as const,
        detail: (findingId: number) => [...root, 'findings', 'detail', findingId] as const,
      },
      documents: {
        all: [...root, 'documents'] as const,
        list: (q?: string) => [...root, 'documents', 'list', { q }] as const,
        detail: (documentId: number) => [...root, 'documents', 'detail', documentId] as const,
        draft: (documentId: number) => [...root, 'documents', 'detail', documentId, 'draft'] as const,
        lock: (documentId: number) => [...root, 'documents', 'detail', documentId, 'lock'] as const,
        cite: (evidenceId: number) => [...root, 'documents', 'cite', evidenceId] as const,
        citeAs: (evidenceId: number, mode: string) => [...root, 'documents', 'cite', evidenceId, mode] as const,
        versions: (documentId: number) => [...root, 'documents', 'detail', documentId, 'versions'] as const,
        version: (documentId: number, version: number) =>
          [...root, 'documents', 'detail', documentId, 'versions', version] as const,
      },
      analyses: {
        all: [...root, 'analyses'] as const,
        list: [...root, 'analyses', 'list'] as const,
        detail: (analysisId: number) => [...root, 'analyses', 'detail', analysisId] as const,
      },
      members: {
        all: [...root, 'members'] as const,
        list: [...root, 'members', 'list'] as const,
        invitations: [...root, 'members', 'invitations'] as const,
        requests: [...root, 'members', 'requests'] as const,
      },
      announcement: {
        all: [...root, 'announcement'] as const,
        detail: [...root, 'announcement', 'detail'] as const,
        history: [...root, 'announcement', 'history'] as const,
      },
      activity: (query: unknown) => [...root, 'activity', query] as const,
      activityAll: [...root, 'activity'] as const,
      discussion: {
        all: [...root, 'discussion'] as const,
        threads: (page: number) => [...root, 'discussion', 'threads', page] as const,
        comments: (threadId: number, page: number) => [...root, 'discussion', 'comments', threadId, page] as const,
        about: (type: string, id: number) => [...root, 'discussion', 'about', type, id] as const,
        tasks: (query: unknown) => [...root, 'discussion', 'tasks', query] as const,
        tasksAll: [...root, 'discussion', 'tasks'] as const,
      },
      /** A comparison computed from its inputs and not stored: it only changes when the inputs do. */
      compare: {
        matn: (inputs: unknown) => [...root, 'compare', 'matn', inputs] as const,
        isnads: (sanadIds: readonly number[]) => [...root, 'compare', 'isnads', sanadIds] as const,
        criticism: (narratorIds: readonly number[]) => [...root, 'compare', 'criticism', narratorIds] as const,
      },
    }
  },

  /** An invitation seen by the person it was sent to, read by its token. */
  invitation: (token: string) => ['invitations', token] as const,

  /** What a visitor sees: no sign-in, so nothing here belongs to a person. */
  public: {
    announcements: (query: unknown) => ['public', 'announcements', query] as const,
    announcement: (slug: string) => ['public', 'announcement', slug] as const,
  },

  library: {
    all: ['library'] as const,
    /** The first page of saved items, used to mark what is already saved. */
    index: ['library', 'index'] as const,
    list: (query: LibraryQuery) => ['library', 'list', query] as const,
    item: (id: number) => ['library', 'item', id] as const,
    collections: ['library', 'collections'] as const,
    tags: ['library', 'tags'] as const,
    sharePreview: (id: number, projectIds: number[], share: ShareOptions) =>
      ['library', 'share-preview', id, projectIds, share] as const,
  },

  corpus: {
    all: ['corpus'] as const,
    search: (params: CorpusSearchParams) => ['corpus', 'search', params] as const,
    hadith: (id: number) => ['corpus', 'hadith', id] as const,
    narrator: (id: number) => ['corpus', 'narrator', id] as const,
    criticism: (id: number, page: number) => ['corpus', 'narrator', id, 'criticism', page] as const,
    narratorLinks: (id: number, kind: 'teachers' | 'students') => ['corpus', 'narrator', id, kind] as const,
    narratorLookup: (term: string) => ['corpus', 'narrator-lookup', term] as const,
    books: (page: number) => ['corpus', 'books', page] as const,
    hukms: ['corpus', 'hukms'] as const,
    picker: (term: string, kind: string, page: number) => ['corpus', 'picker', term, kind, page] as const,
  },

  exports: {
    all: ['exports'] as const,
    list: (page: number) => ['exports', 'list', page] as const,
    quota: ['exports', 'quota'] as const,
    manifest: (id: number) => ['exports', 'manifest', id] as const,
    job: (id: number) => ['exports', 'job', id] as const,
    preview: (request: ExportRequest) => ['exports', 'preview', request] as const,
  },

  /** Administration (screen 13). Everything an administrator sees is under one root. */
  admin: {
    all: ['admin'] as const,
    users: (query: unknown) => ['admin', 'users', query] as const,
    usersAll: ['admin', 'users'] as const,
    applications: (query: unknown) => ['admin', 'applications', query] as const,
    applicationsAll: ['admin', 'applications'] as const,
    closures: ['admin', 'closures'] as const,
    limits: ['admin', 'limits'] as const,
    grants: ['admin', 'grants'] as const,
    jobs: (query: unknown) => ['admin', 'jobs', query] as const,
    ops: ['admin', 'ops'] as const,
    audit: (query: unknown) => ['admin', 'audit', query] as const,
    proposals: (query: unknown) => ['admin', 'proposals', query] as const,
    proposalsAll: ['admin', 'proposals'] as const,
    /** The numbers beside the navigation: waiting applications, accounts, active grants, alerts. */
    counts: ['admin', 'counts'] as const,
    count: (what: string) => ['admin', 'counts', what] as const,
  },

  /** The account's notification list (the unread count the shell and Home show is `home.unread`). */
  notifications: {
    all: ['notifications'] as const,
    list: (query: unknown) => ['notifications', 'list', query] as const,
    assignedTasks: ['notifications', 'assigned-tasks'] as const,
  },

  savedSearches: {
    /** The account's own saved searches, every page. */
    personal: ['saved-searches'] as const,
    personalList: (page: number) => ['saved-searches', 'list', page] as const,
  },
}
