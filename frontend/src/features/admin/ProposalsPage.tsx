import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { countProposals, decideProposal, listProposals } from '@/api/admin'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import type { CorpusProposal } from '@/api/schemas/admin'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { MutationNotice } from '@/components/MutationNotice'
import { Pagination } from '@/components/Pagination'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { useQueryParams } from '@/hooks/useQueryParams'
import { AdminHead, FilterChips } from './AdminHead'
import styles from './Admin.module.css'

const STATUSES = ['submitted', 'accepted', 'rejected'] as const
const CORPUS_CODE = { hadiths: 'REP', narrators: 'NAR', books: 'BK', sanads: 'CH' } as const

const corpusCode = (p: CorpusProposal) => {
  const prefix = CORPUS_CODE[p.corpus_table as keyof typeof CORPUS_CODE]
  return prefix ? formatCode(prefix, p.corpus_id) : `${p.corpus_table} #${p.corpus_id}`
}

/**
 * Screen 13, Corpus corrections: what researchers propose to change in the corpus, and the decision on each. A
 * decision is recorded and audited; it does not change the corpus (nothing applies an accepted proposal yet, C-20).
 */
export function ProposalsPage() {
  const { t } = useTranslation()
  const { n, date } = usePreferences()
  const qc = useQueryClient()
  const url = useQueryParams()
  const [asking, setAsking] = useState<{ id: number; status: 'accepted' | 'rejected' } | null>(null)

  const status = url.oneOf('status', STATUSES, 'submitted')
  const list = useQuery({
    queryKey: qk.admin.proposals({ status, page: url.page }),
    queryFn: ({ signal }) => listProposals({ status, page: url.page }, signal),
    placeholderData: keepPreviousData,
  })
  const counts = useQueries({
    queries: STATUSES.map((s) => ({ queryKey: qk.admin.count(`proposals:${s}`), queryFn: ({ signal }: { signal: AbortSignal }) => countProposals(s, signal) })),
  })

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: 'accepted' | 'rejected' }) => decideProposal(id, decision),
    onSuccess: async () => {
      setAsking(null)
      await invalidate.adminProposalsChanged(qc)
    },
    onError: () => setAsking(null),
  })

  const items = list.data?.items ?? []
  const target = asking ? items.find((p) => p.id === asking.id) : undefined
  const total = list.data?.pagination?.total_items ?? items.length

  return (
    <section>
      <AdminHead title={t('admin.proposals.title')} subtitle={t('admin.proposals.subtitle', { count: total, formattedCount: n(total) })} />
      <p className={styles.notice} role="note">
        {t('admin.proposals.note')}
      </p>

      <FilterChips
        label={t('admin.proposals.filter')}
        value={status}
        onChange={(value) => url.set({ status: value })}
        items={STATUSES.map((s, i) => ({ value: s, label: t(`admin.proposals.status.${s}`), count: counts[i]?.data === undefined ? undefined : n(counts[i]!.data!) }))}
      />
      {decide.isSuccess && decide.variables ? (
        <p className={styles.success} role="status">
          {t('admin.proposals.done', { decision: t(`admin.proposals.decision.${decide.variables.decision}`) })}
        </p>
      ) : null}
      <MutationNotice error={decide.error} title={t('admin.proposals.failed')} />

      <StateBoundary
        state={viewStateOf(list, { isEmpty: (d) => (d as { items: unknown[] }).items.length === 0 })}
        errorValue={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <div className={styles.empty}>
            <h2>{t(`admin.proposals.empty.${status}.title`)}</h2>
            <p>{t(`admin.proposals.empty.${status}.body`)}</p>
          </div>
        }
      >
        <ul className={styles.thread}>
          {items.map((p) => (
            <li key={p.id}>
              <article aria-label={`${corpusCode(p)}`}>
                <p className={styles.code}>
                  {formatCode('COR', p.id)} · {t(`admin.proposals.tables.${p.corpus_table}`, { defaultValue: p.corpus_table })} {corpusCode(p)}
                  {p.created_at ? ` · ${t('admin.proposals.proposed', { when: date(p.created_at) })}` : ''}
                </p>
                <dl className={styles.facts}>
                  <dt>{t('admin.proposals.current')}</dt>
                  <dd>{p.current_value ? <BidiText>{p.current_value}</BidiText> : '—'}</dd>
                  <dt>{t('admin.proposals.proposedValue')}</dt>
                  <dd>{p.proposed_value ? <BidiText>{p.proposed_value}</BidiText> : '—'}</dd>
                  <dt>{t('admin.proposals.evidence')}</dt>
                  <dd>{p.evidence_notes ? <BidiText>{p.evidence_notes}</BidiText> : '—'}</dd>
                  <dt>{t('admin.proposals.by')}</dt>
                  <dd>{p.researcher ? <BidiText>{p.researcher.display_name}</BidiText> : '—'}</dd>
                </dl>
                {p.status === 'submitted' ? (
                  <div className={styles.actions}>
                    <Button variant="primary" disabled={decide.isPending} onClick={() => setAsking({ id: p.id, status: 'accepted' })} aria-label={`${t('admin.proposals.accept')} ${formatCode('COR', p.id)}`}>
                      {t('admin.proposals.accept')}
                    </Button>
                    <Button variant="danger" disabled={decide.isPending} onClick={() => setAsking({ id: p.id, status: 'rejected' })} aria-label={`${t('admin.proposals.reject')} ${formatCode('COR', p.id)}`}>
                      {t('admin.proposals.reject')}
                    </Button>
                  </div>
                ) : (
                  <p className={styles.hint}>
                    {t(`admin.proposals.decided.${p.status}`, { defaultValue: p.status })}
                    {p.decided_at ? ` · ${date(p.decided_at, { time: true })}` : ''}
                    {p.decider ? ` · ${p.decider.display_name}` : ''}
                  </p>
                )}
              </article>
            </li>
          ))}
        </ul>
        {list.data?.pagination ? <Pagination pagination={list.data.pagination} onPage={(page) => url.set({ page }, { keepPage: true })} /> : null}
      </StateBoundary>

      <ConfirmAction
        open={asking !== null && !!target}
        danger={asking?.status === 'rejected'}
        title={t(asking?.status === 'rejected' ? 'admin.proposals.rejectTitle' : 'admin.proposals.acceptTitle', { code: target ? formatCode('COR', target.id) : '' })}
        confirmLabel={t(asking?.status === 'rejected' ? 'admin.proposals.rejectConfirm' : 'admin.proposals.acceptConfirm')}
        busy={decide.isPending}
        onCancel={() => setAsking(null)}
        onConfirm={() => asking && decide.mutate({ id: asking.id, decision: asking.status })}
      >
        <p>{t(asking?.status === 'rejected' ? 'admin.proposals.rejectBody' : 'admin.proposals.acceptBody')}</p>
      </ConfirmAction>
    </section>
  )
}
