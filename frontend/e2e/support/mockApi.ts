import type { Page, Route } from '@playwright/test'

/**
 * Answers the platform's API from memory so the built app can be driven in a real browser without the backend. Only what
 * the checks need is modelled; any other GET answers an empty list and anything else answers 404 and is recorded in
 * `unhandled`, so a test can fail on a call it did not expect. This is test data, not a statement of what the server does.
 */
const envelope = (data: unknown, extra: Record<string, unknown> = {}) => ({ success: true, message: 'Success', data, meta: { timestamp: '2026-10-06T00:00:00Z', version: 'v1', ...extra } })
const page = (n: number, per = 20) => ({ pagination: { current_page: 1, per_page: per, total_items: n, total_pages: 1, has_more: false } })

export const USER = { id: 1, display_name: 'Shilan Rashid', email: 'shilan@example.org', status: 'approved', is_admin: false, preferred_language: 'en', profile: null }

const PROJECT = {
  id: 12,
  owner_id: 1,
  title: 'Chains of the wuḍūʾ reports in the Sunan collections',
  question: 'Do the Kufan chains of the “three times” wording share a common link?',
  scope: 'All 14 occurrences in the six Sunan collections.',
  primary_language: 'ar',
  languages: ['ar', 'ckb'],
  tags: ['wuḍūʾ'],
  stage: 'analysing',
  my_role: 'owner',
  is_archived: false,
  is_deleted: false,
  evidence_count: 38,
  resource_count: 12,
  finding_count: 6,
  last_activity_at: '2026-10-05T09:00:00Z',
  created_at: '2026-09-18T09:00:00Z',
  updated_at: '2026-10-05T09:00:00Z',
  next_action: { label: 'Review 7 candidate evidence items', target: '/projects/12/evidence?state=candidate' },
  owner: { id: 1, display_name: 'Shilan Rashid' },
  memberships: [{ user_id: 1, role: 'owner', status: 'accepted', user: { id: 1, display_name: 'Shilan Rashid' } }],
}

const EVIDENCE = [4, 7, 9].map((id) => ({ id, project_id: 12, resource_id: 70 + id, captured_text: id === 7 ? 'مَرَّةً مَرَّةً' : 'تَوَضَّأَ ثَلاَثًا ثَلاَثًا', locator: `Vol. 1, p. ${70 + id}`, state: id === 9 ? 'candidate' : 'included', resource: { id: 70 + id, resource_type: 'external', title: 'Sunan Abī Dāwūd, 106' }, collector: { id: 1, display_name: 'Shilan Rashid' }, created_at: '2026-10-01T09:00:00Z' }))

const FINDING = { id: 4, project_id: 12, question: 'Do the Kufan chains share a common link?', claim: 'The three-times wording is the shortest form.', reasoning: 'Eleven of fourteen occurrences carry only that wording.', limitations: null, status: 'provisional', version: 1, evidence_items: [], documents: [], created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-02T09:00:00Z' }

const DOCUMENT = { id: 31, project_id: 12, title: 'Main article', status: 'draft', latest_version: { id: 1, document_id: 31, version_number: 1, content: '# Main article\n\nتَوَضَّأَ ثَلاَثًا ثَلاَثًا [@EV-0004]\n\n> أَنَّ النَّبِيَّ تَوَضَّأَ\n', created_at: '2026-10-02T09:00:00Z', author: { id: 1, display_name: 'Shilan Rashid' } }, findings: [], created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-02T09:00:00Z' }

const ANNOUNCEMENT = { id: 3, slug: 'wudu-chains', title: 'Looking for collaborators on the wuḍūʾ chains', summary: 'We study how the three-times wording travels.', status: 'published', published_at: '2026-10-02T09:00:00Z', researchers: [{ display_name: 'Shilan Rashid' }], topics: ['wuḍūʾ'] }

const PUBLICATION = { id: 8, slug: 'kufan-chains-v1', title: 'The Kufan chains of the three-times report', abstract: 'A study of a common link.', published_at: '2026-10-03T09:00:00Z', version: 1, licence: 'CC BY 4.0', authors: [{ display_name: 'Shilan Rashid' }], topics: ['wuḍūʾ'], type: 'article' }

type Reply = { status?: number; body: unknown }
type Handler = (url: URL, method: string, body: unknown) => Reply | unknown

export interface MockOptions {
  /** Signed in (a token is put in the tab) or a visitor. */
  signedIn?: boolean
  language?: 'en' | 'ckb' | 'ar'
  /** Extra or replacement answers, matched against the path after /api/v1, before the built-in ones. */
  extra?: [RegExp, Handler][]
}

export async function installApi(p: Page, options: MockOptions = {}) {
  const unhandled: string[] = []
  const calls: { method: string; path: string; body: unknown }[] = []
  const language = options.language ?? 'en'

  await p.addInitScript(
    ([signedIn, lang]) => {
      try {
        if (signedIn) sessionStorage.setItem('oh.token', 'e2e-token')
        localStorage.setItem('oh.lang', lang as string)
      } catch {
        /* storage unavailable */
      }
    },
    [options.signedIn ?? false, language] as const,
  )

  const builtIn: [RegExp, Handler][] = [
    [/^GET \/auth\/me$/, () => USER],
    [/^GET \/notifications\/unread-count$/, () => ({ unread_count: 2 })],
    [/^GET \/projects$/, () => ({ __list: [PROJECT], extra: { ...page(1, 5), counts: { owned: 1, shared: 0, archived: 0, trash: 0 } } })],
    [/^GET \/projects\/12$/, () => PROJECT],
    [/^GET \/projects\/12\/summary$/, () => ({ project_id: 12, stage: 'analysing', evidence_counts: { candidate: 7, included: 19, reviewed: 8, excluded: 3, unresolved: 1, total: 38 }, resources_count: 12, saved_searches_count: 4, result_sets_count: 2, analyses_count: 3, findings_count: 6, documents_count: 2, open_tasks_count: 1, last_activity_at: '2026-10-05T09:00:00Z' })],
    [/^GET \/projects\/12\/evidence$/, () => ({ __list: EVIDENCE, extra: page(EVIDENCE.length) })],
    [/^GET \/projects\/12\/findings$/, () => ({ __list: [FINDING], extra: page(1) })],
    [/^GET \/projects\/12\/documents$/, () => ({ __list: [DOCUMENT], extra: page(1) })],
    [/^GET \/projects\/12\/documents\/31$/, () => DOCUMENT],
    [/^GET \/projects\/12\/documents\/31\/versions$/, () => ({ __list: [DOCUMENT.latest_version], extra: page(1) })],
    [/^GET \/projects\/12\/argument-graph$/, () => ({ nodes: [{ id: 1, node_type: 'claim', title: 'The claim', content: 'The shortest wording is original.', evidence_id: null, finding_id: 4, order_index: 0 }, { id: 2, node_type: 'objection', title: 'An objection', content: 'The longer wording is earlier.', evidence_id: 4, evidence: { id: 4, captured_text: 'تَوَضَّأَ ثَلاَثًا', locator: 'Vol. 1, p. 78', state: 'included' }, finding_id: null, order_index: 1 }], edges: [{ id: 1, source_node_id: 2, target_node_id: 1, relation_type: 'refutes' }] })],
    [/^GET \/projects\/12\/members$/, () => [{ id: 1, user_id: 1, role: 'owner', status: 'accepted', joined_at: '2026-09-18T09:00:00Z', user: { id: 1, display_name: 'Shilan Rashid', affiliation: 'Soran University' }, contribution_summary: { evidence_items: 20, documents: 5, comments: 4, tasks: 0 } }]],
    [/^GET \/public\/announcements$/, () => ({ __list: [ANNOUNCEMENT], extra: page(1) })],
    [/^GET \/public\/research$/, () => ({ __list: [PUBLICATION], extra: { ...page(1), facets: {} } })],
    [/^GET \/library\/items$/, () => ({ __list: [], extra: page(0) })],
    [/^GET \/exports\/quota$/, () => ({ running: 0, queued: 0, limit: 2 })],
  ]

  await p.route('**/api/v1/**', async (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.replace(/^\/api\/v1/, '')
    const method = req.method()
    let body: unknown
    try {
      body = req.postDataJSON()
    } catch {
      body = undefined
    }
    calls.push({ method, path, body })
    const key = `${method} ${path}`
    const found = [...(options.extra ?? []), ...builtIn].find(([re]) => re.test(key))
    if (!found) {
      if (method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(envelope([], page(0))) })
      unhandled.push(key)
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not modelled by the e2e mock' }) })
    }
    const out = found[1](url, method, body) as Reply & { __list?: unknown[]; extra?: Record<string, unknown> }
    if (out && typeof out === 'object' && '__list' in out) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(envelope(out.__list, out.extra)) })
    if (out && typeof out === 'object' && 'status' in out && 'body' in out) return route.fulfill({ status: out.status ?? 200, contentType: 'application/json', body: JSON.stringify(out.body) })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(envelope(out)) })
  })

  return { unhandled, calls }
}
