import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail, summary } from '@/test/projectMocks'
import { server } from '@/test/server'
import { correctionTarget, hadithIdOf, needsReason } from './evidenceModel'

const TEXT = 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى'

const person = { id: 1, display_name: 'Shilan Rashid' }

const evidence = (over: Record<string, unknown> = {}) => ({
  id: 27,
  project_id: 12,
  resource_id: 24,
  captured_text: TEXT,
  locator: 'Bukhari, Kitab Bad’ al-Wahy, Hadith 1',
  source_version: 'Sultaniyyah Edition',
  content_hash: '318fb355304712776c0ecb0f5bae86a23e94e0d7b8aadc24f123d2c8c3cbe232',
  state: 'included',
  exclusion_reason: null,
  collector_id: 1,
  created_at: '2026-10-04T18:46:11Z',
  updated_at: '2026-10-04T18:46:11Z',
  resource: {
    id: 24,
    resource_type: 'corpus_hadith',
    corpus_table: 'hadiths',
    corpus_id: 1,
    title: 'Sahih al-Bukhari #1 — Bad’ al-Wahy',
    author: 'al-Bukhārī',
    source_metadata: [],
  },
  collector: person,
  annotations: [],
  ...over,
})

const annotation = (over: Record<string, unknown> = {}) => ({
  id: 6,
  author_id: 1,
  annotation_kind: 'interpretation',
  visibility: 'private',
  body: 'My reading of the isnād',
  created_at: '2026-10-04T18:46:11Z',
  author: person,
  ...over,
})

const hadith = {
  id: 1,
  matn: TEXT,
  clean_matn: null,
  references: [
    {
      id: 1,
      hadith_id: 1,
      book: { id: 1, title: 'مسند الربيع بن حبيب' },
      hukm: { id: 6, name: 'Sa7ee7', label: 'صحيح' },
      sanads: [
        {
          id: 1,
          reference_id: 1,
          narrator_nodes: [
            { id: 1, narrator_id: 10, narrator: { id: 10, name: 'ربيع بن حبيب', deathdate: '170', rutba_description: 'ثقة' } },
            { id: 2, narrator_id: 11, narrator: { id: 11, name: 'جابر بن زيد', deathdate: '93' } },
          ],
        },
      ],
    },
  ],
}

const pg = (n: number) => ({ pagination: { current_page: 1, per_page: 20, total_items: n, total_pages: 1, has_more: false } })

interface Apis {
  items?: unknown[]
  detail?: Record<string, unknown> | Response
  deps?: { findings?: unknown[]; documents?: unknown[] }
  history?: unknown[]
  role?: string
  patch?: (body: Record<string, unknown>) => Response | undefined
  del?: (confirm: boolean) => Response | undefined
  postAnnotation?: (body: Record<string, unknown>) => Response | undefined
  patchAnnotation?: (body: Record<string, unknown>) => Response | undefined
  counts?: Record<string, number>
}

function mockEvidence(o: Apis = {}) {
  const calls = {
    lists: [] as URLSearchParams[],
    patches: [] as Record<string, unknown>[],
    deletes: [] as boolean[],
    annotations: [] as Record<string, unknown>[],
    annotationPatches: [] as Record<string, unknown>[],
    links: [] as Record<string, unknown>[],
    unlinks: [] as string[],
    proposals: [] as Record<string, unknown>[],
  }
  mockProjectApis(12, {
    detail: projectDetail({
      memberships: [{ user_id: 1, role: o.role ?? 'owner', status: 'accepted', user: person }],
      ...(o.role && o.role !== 'owner' ? { owner_id: 2 } : {}),
    }),
    summary: summary({
      evidence_counts: { candidate: 1, included: 1, reviewed: 0, excluded: 1, unresolved: 0, total: 3, ...(o.counts ?? {}) },
    }),
  })
  const items = o.items ?? [evidence(), evidence({ id: 28, state: 'candidate', captured_text: 'نص آخر' })]
  server.use(
    http.get('*/api/v1/projects/12/evidence', ({ request }) => {
      calls.lists.push(new URL(request.url).searchParams)
      return HttpResponse.json(envelope(items, pg(items.length)))
    }),
    http.get('*/api/v1/projects/12/evidence/:id', ({ params }) => {
      if (o.detail instanceof Response) return o.detail
      const found = (items as { id: number }[]).find((i) => i.id === Number(params.id))
      if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 })
      return HttpResponse.json(envelope({ ...found, ...(o.detail ?? {}) }))
    }),
    http.get('*/api/v1/projects/12/evidence/:id/history', ({ params }) =>
      HttpResponse.json(
        envelope({
          evidence_id: Number(params.id),
          current_state: 'included',
          created_at: '2026-10-04T18:46:11Z',
          collector: 'Shilan Rashid',
          history: o.history ?? [],
        }),
      ),
    ),
    http.get('*/api/v1/projects/12/evidence/:id/dependencies', () =>
      HttpResponse.json(envelope({ findings: o.deps?.findings ?? [], documents: o.deps?.documents ?? [] })),
    ),
    http.patch('*/api/v1/projects/12/evidence/:id', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.patches.push(body)
      const custom = o.patch?.(body)
      if (custom) return custom
      return HttpResponse.json(envelope(evidence({ id: Number(params.id), state: body.state, exclusion_reason: body.state_reason })))
    }),
    http.delete('*/api/v1/projects/12/evidence/:id', ({ request }) => {
      const confirm = new URL(request.url).searchParams.get('confirm') === 'true'
      calls.deletes.push(confirm)
      return o.del?.(confirm) ?? HttpResponse.json(envelope(null))
    }),
    http.post('*/api/v1/projects/12/evidence/:id/annotations', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.annotations.push(body)
      const custom = o.postAnnotation?.(body)
      if (custom) return custom
      return HttpResponse.json(envelope(annotation({ id: 50, ...body })), { status: 201 })
    }),
    http.patch('*/api/v1/projects/12/evidence/:id/annotations/:aid', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.annotationPatches.push(body)
      const custom = o.patchAnnotation?.(body)
      if (custom) return custom
      return HttpResponse.json(envelope(annotation({ ...body })))
    }),
    http.get('*/api/v1/projects/12/findings', () =>
      HttpResponse.json(envelope([{ id: 6, claim: 'The singularity is authentic', status: 'supported' }, { id: 7, claim: 'Second claim', status: 'provisional' }], pg(2))),
    ),
    http.post('*/api/v1/projects/12/findings/:fid/evidence', async ({ request }) => {
      calls.links.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json(envelope({}))
    }),
    http.delete('*/api/v1/projects/12/findings/:fid/evidence/:eid', ({ params }) => {
      calls.unlinks.push(`${params.fid}/${params.eid}`)
      return HttpResponse.json(envelope(null))
    }),
    http.get('*/api/v1/corpus/hadiths/1', () => HttpResponse.json(envelope(hadith))),
    http.post('*/api/v1/corpus/proposals', async ({ request }) => {
      calls.proposals.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json(envelope({ id: 31, status: 'submitted' }), { status: 201 })
    }),
  )
  return calls
}

describe('evidence model', () => {
  it('needs a reason for excluded and unresolved only', () => {
    expect(['excluded', 'unresolved'].every(needsReason)).toBe(true)
    expect(['candidate', 'included', 'reviewed'].some(needsReason)).toBe(false)
  })

  it('finds the report behind a corpus report or an occurrence, and nothing for an external source', () => {
    const base = { id: 1, title: 'x', resource_type: 'x' }
    expect(hadithIdOf({ ...base, corpus_table: 'hadiths', corpus_id: 5 })).toBe(5)
    expect(hadithIdOf({ ...base, corpus_table: 'hadith_references', corpus_id: 9, source_metadata: { hadith_id: 5 } })).toBe(5)
    expect(hadithIdOf({ ...base, corpus_table: null, corpus_id: null })).toBeNull()
    expect(correctionTarget({ ...base, corpus_table: 'hadith_references', corpus_id: 9, source_metadata: { hadith_id: 5 } })).toEqual({
      corpus_table: 'hadiths',
      corpus_id: 5,
      code: 'OCC-000009',
    })
    expect(correctionTarget({ ...base, corpus_table: null, corpus_id: null })).toBeNull()
  })
})

describe('Evidence inspector', () => {
  it('lists evidence with state counts and opens one in the inspector', async () => {
    mockMe()
    mockEvidence()
    renderApp('/projects/12/evidence', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Evidence' })).toBeInTheDocument()
    expect(await screen.findByText('3 evidence items')).toBeInTheDocument()
    const row = await screen.findByRole('button', { name: /EV-0028/ })
    expect(within(row).getByText('Candidate')).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /EV-0027/ }))
    const inspector = await screen.findByRole('article', { name: 'EV-0027' })
    expect(within(inspector).getByText(TEXT)).toBeInTheDocument()
    expect(within(inspector).getByText('Bukhari, Kitab Bad’ al-Wahy, Hadith 1')).toBeInTheDocument()
    expect(within(inspector).getByText('Sultaniyyah Edition')).toBeInTheDocument()
    expect(within(inspector).getByText('REP-000001')).toBeInTheDocument()
    // What the API does not record is said so, not left blank.
    expect(within(inspector).getByText(/search run or resource it was collected from isn't recorded yet/)).toBeInTheDocument()
  })

  it('shows the first-run empty state with both ways to add evidence', async () => {
    mockMe()
    mockEvidence({ items: [], counts: { candidate: 0, included: 0, excluded: 0, total: 0 } })
    renderApp('/projects/12/evidence', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'No evidence yet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Search the corpus' })).toHaveAttribute('href', '/projects/12/searches')
    expect(screen.getByRole('link', { name: 'From project resources' })).toBeInTheDocument()
  })

  it('filters by state and tells a filtered-out list apart from an empty project', async () => {
    mockMe()
    const calls = mockEvidence({ items: [] })
    renderApp('/projects/12/evidence?state=excluded', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'No evidence matches' })).toBeInTheDocument()
    expect(calls.lists[0]?.get('state')).toBe('excluded')
    await userEvent.click(screen.getByRole('button', { name: /^Candidate/ }))
    await waitFor(() => expect(calls.lists.some((p) => p.get('state') === 'candidate')).toBe(true))
  })

  it('says an evidence link that is not in this project is not available', async () => {
    mockMe()
    mockEvidence()
    renderApp('/projects/12/evidence?item=999', { signedIn: true })
    expect(await screen.findByRole('heading', { name: "That evidence isn't available" })).toBeInTheDocument()
  })

  it('shows chain, narrators and judgments from the corpus record', async () => {
    mockMe()
    mockEvidence()
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    expect(await screen.findByText('Chain 1 of 1 · 2 narrators', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('ربيع بن حبيب')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Narrators' }))
    expect(screen.getByText(/Grade: ثقة/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Judgments' }))
    expect(screen.getByText(/Ruling: صحيح/)).toBeInTheDocument()
  })

  it('says an external source has no chain to show', async () => {
    mockMe()
    mockEvidence({ items: [evidence({ resource: { id: 3, resource_type: 'external', corpus_table: null, corpus_id: null, title: 'An article' } })] })
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    expect(await screen.findByText(/isn't a corpus record, so there is no chain or judgment to show/)).toBeInTheDocument()
  })

  it('flags a missing locator as an incomplete citation, never guessed', async () => {
    mockMe()
    mockEvidence({ items: [evidence({ locator: null })] })
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    expect(await screen.findByText('Incomplete citation')).toBeInTheDocument()
    expect(screen.getByText(/never guessed/)).toBeInTheDocument()
  })

  it('requires a reason to exclude, then sends state and reason', async () => {
    mockMe()
    const calls = mockEvidence()
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    await userEvent.click(await screen.findByRole('radio', { name: 'Excluded' }))
    const dialog = await screen.findByRole('dialog', { name: /EV-0027 · Included → Excluded/ })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change state' }))
    expect(await within(dialog).findByText('Enter a reason.')).toBeInTheDocument()
    expect(calls.patches).toHaveLength(0)
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Out of scope')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change state' }))
    await waitFor(() => expect(calls.patches).toEqual([{ state: 'excluded', state_reason: 'Out of scope' }]))
  })

  it('lets Reviewed be set without a reason', async () => {
    mockMe()
    const calls = mockEvidence()
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    await userEvent.click(await screen.findByRole('radio', { name: 'Reviewed' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Optional. It is attributed to you and dated.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change state' }))
    await waitFor(() => expect(calls.patches).toEqual([{ state: 'reviewed', state_reason: null }]))
  })

  it('does not show a state the server did not keep', async () => {
    mockMe()
    mockEvidence({ patch: () => HttpResponse.json(envelope(evidence({ state: 'included' }))) })
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    await userEvent.click(await screen.findByRole('radio', { name: 'Reviewed' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change state' }))
    expect(await within(dialog).findByText(/did not keep the new state/)).toBeInTheDocument()
  })

  it('says how many findings keep the link when the state changes', async () => {
    mockMe()
    mockEvidence({ deps: { findings: [{ id: 6, claim: 'Claim', pivot: { relation_type: 'supporting' } }] } })
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    await screen.findByText('F-06')
    await userEvent.click(screen.getByRole('radio', { name: 'Reviewed' }))
    expect(await screen.findByText(/Used in 1 finding\. It keeps the link and will show this evidence as Reviewed/)).toBeInTheDocument()
  })

  it('shows the history: the server’s own wording for each change, and when it was added', async () => {
    mockMe()
    mockEvidence({
      history: [{ id: 1, action: 'evidence_state_changed', summary: 'Changed state of EV-27: candidate → included (reason: ok)', created_at: '2026-10-05T10:00:00Z', actor: person }],
    })
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    expect(await screen.findByText(/candidate → included \(reason: ok\)/)).toBeInTheDocument()
    expect(screen.getByText('Candidate · added by Shilan Rashid')).toBeInTheDocument()
  })

  it('gives a viewer the evidence but no way to change or remove it', async () => {
    mockMe()
    mockEvidence({ role: 'viewer' })
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    expect(await screen.findByText(/can read evidence but not change its state/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Reviewed' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Remove evidence…' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Link to finding' })).not.toBeInTheDocument()
  })
})

describe('Annotations, findings and removal', () => {
  it('adds a private annotation by default', async () => {
    mockMe()
    const calls = mockEvidence()
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    await userEvent.type(await screen.findByLabelText('Annotation'), 'A thought')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(calls.annotations).toEqual([{ annotation_kind: 'interpretation', body: 'A thought', visibility: 'private' }]))
  })

  it('needs the scholar and the place for an attributed judgment', async () => {
    mockMe()
    const calls = mockEvidence()
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    await userEvent.selectOptions(await screen.findByLabelText('Kind'), 'Attributed judgment (needs a source)')
    await userEvent.type(screen.getByLabelText('Annotation'), 'Judged weak')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect((await screen.findAllByText('A judgment needs the scholar it is attributed to and where it is stated.')).length).toBeGreaterThan(0)
    expect(calls.annotations).toHaveLength(0)
    await userEvent.type(screen.getByLabelText(/Attributed to/), 'al-Tirmidhī')
    await userEvent.type(screen.getByLabelText(/Where it is stated/), 'Sunan no. 12')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(calls.annotations).toHaveLength(1))
    expect(calls.annotations[0]).toMatchObject({ annotation_kind: 'scholarly_judgment', attributed_to: 'al-Tirmidhī', source_locator: 'Sunan no. 12' })
  })

  it('warns when the server saved a judgment but dropped its attribution (C-16)', async () => {
    mockMe()
    mockEvidence({
      postAnnotation: () => HttpResponse.json(envelope(annotation({ id: 51, annotation_kind: 'scholarly_judgment', visibility: 'private', attributed_to: null })), { status: 201 }),
    })
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    await userEvent.selectOptions(await screen.findByLabelText('Kind'), 'Attributed judgment (needs a source)')
    await userEvent.type(screen.getByLabelText('Annotation'), 'Judged weak')
    await userEvent.type(screen.getByLabelText(/Attributed to/), 'al-Tirmidhī')
    await userEvent.type(screen.getByLabelText(/Where it is stated/), 'Sunan no. 12')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText(/did not keep who it is attributed to/)).toBeInTheDocument()
  })

  it('promotes my private annotation to the project, and hides actions on other people’s', async () => {
    mockMe()
    const calls = mockEvidence({
      detail: {
        annotations: [
          annotation({ id: 6 }),
          annotation({ id: 7, author_id: 9, visibility: 'project_shared', body: 'Someone else', author: { id: 9, display_name: 'Karwan' } }),
        ],
      },
    })
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    expect(await screen.findByText('Someone else')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Share with project' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Make private' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Share with project' }))
    await waitFor(() => expect(calls.annotationPatches).toEqual([{ visibility: 'project_shared' }]))
  })

  it('links the evidence to a finding with a relation', async () => {
    mockMe()
    const calls = mockEvidence({ deps: { findings: [] } })
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: '+ Link to finding' }))
    const dialog = await screen.findByRole('dialog', { name: 'Link EV-0027 to a finding' })
    await userEvent.selectOptions(await within(dialog).findByLabelText(/Finding/), '6')
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Opposes' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Link' }))
    await waitFor(() => expect(calls.links).toEqual([{ evidence_id: 27, relation_type: 'opposing' }]))
  })

  it('unlinks a finding', async () => {
    mockMe()
    const calls = mockEvidence({ deps: { findings: [{ id: 6, claim: 'Claim', pivot: { relation_type: 'supporting' } }] } })
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Unlink F-06' }))
    await waitFor(() => expect(calls.unlinks).toEqual(['6/27']))
  })

  it('removes unused evidence after one confirmation', async () => {
    mockMe()
    const calls = mockEvidence()
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Remove evidence…' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/It can't be undone/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove EV-0027' }))
    await waitFor(() => expect(calls.deletes).toEqual([false]))
  })

  it('lists what uses the evidence before removing it, and offers Excluded instead', async () => {
    mockMe()
    const calls = mockEvidence({
      del: (confirm) =>
        confirm
          ? undefined
          : HttpResponse.json(
              {
                success: false,
                error: { code: 'HAS_DEPENDENCIES', message: 'in use', details: { findings_count: 1, citations_count: 2, dependent_findings: [{ id: 6, claim: 'The singularity is authentic' }] } },
              },
              { status: 409 },
            ),
    })
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Remove evidence…' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove EV-0027' }))
    expect(await within(dialog).findByText('This evidence is in use')).toBeInTheDocument()
    expect(within(dialog).getByText('Removing it affects 1 finding and 2 document citations.')).toBeInTheDocument()
    expect(within(dialog).getByText('The singularity is authentic')).toBeInTheDocument()
    expect(calls.deletes).toEqual([false])

    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove EV-0027' }))
    await waitFor(() => expect(calls.deletes).toEqual([false, true]))
  })

  it('opens the Excluded dialog from the in-use warning', async () => {
    mockMe()
    mockEvidence({
      del: () => HttpResponse.json({ success: false, error: { code: 'HAS_DEPENDENCIES', message: 'in use', details: { findings_count: 1 } } }, { status: 409 }),
    })
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Remove evidence…' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove EV-0027' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Mark Excluded instead' }))
    expect(await screen.findByRole('dialog', { name: /Included → Excluded/ })).toBeInTheDocument()
  })

  it('sends a corpus correction proposal linked to the evidence', async () => {
    mockMe()
    const calls = mockEvidence()
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Propose corpus correction…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Propose a correction to the corpus' })
    await userEvent.type(within(dialog).getByLabelText(/Proposed value/), '64')
    await userEvent.type(within(dialog).getByLabelText(/Explanation/), 'The printed edition shows page 64.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send proposal' }))
    await waitFor(() => expect(calls.proposals).toHaveLength(1))
    expect(calls.proposals[0]).toEqual({
      corpus_table: 'hadiths',
      corpus_id: 1,
      current_value: 'Unknown (not recorded)',
      proposed_value: 'Page number: 64',
      evidence_notes: 'The printed edition shows page 64.',
      evidence_id: 27,
    })
    expect(await screen.findByText('Proposal COR-0031 sent to the corpus editors.')).toBeInTheDocument()
  })

  it('explains why a correction cannot be proposed from an external source', async () => {
    mockMe()
    mockEvidence({ items: [evidence({ resource: { id: 3, resource_type: 'external', corpus_table: null, corpus_id: null, title: 'An article' } })] })
    renderApp('/projects/12/evidence?item=27', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Propose corpus correction…' }))
    expect(await screen.findByText(/doesn't point to a corpus record/)).toBeInTheDocument()
  })
})
