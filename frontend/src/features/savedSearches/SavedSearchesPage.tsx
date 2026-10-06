import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listHukms } from '@/api/searchWorkspace'
import { deletePersonalSearch, listPersonalSearches } from '@/api/savedSearches'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { MutationNotice } from '@/components/MutationNotice'
import { Pagination } from '@/components/Pagination'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { useQueryParams } from '@/hooks/useQueryParams'
import { definitionOf, queryCode } from '../search/searchModel'
import { OpenInProjectDialog } from './OpenInProjectDialog'
import { RenameSearchDialog } from './RenameSearchDialog'
import { filterParts } from './savedSearchesModel'
import styles from './SavedSearches.module.css'

type Dialog = { kind: 'open' | 'rename' | 'delete'; id: number } | null

/**
 * Screen 08s: the searches only this account can see. A search is run inside a project, because a run is a record
 * that belongs to a project, so each one is opened in a project with its text, mode and filters filled in.
 */
export function SavedSearchesPage() {
  const { t } = useTranslation()
  const { n, relative } = usePreferences()
  const qc = useQueryClient()
  const url = useQueryParams()
  const [dialog, setDialog] = useState<Dialog>(null)

  const list = useQuery({
    queryKey: qk.savedSearches.personalList(url.page),
    queryFn: ({ signal }) => listPersonalSearches(url.page, signal),
    placeholderData: keepPreviousData,
  })
  const hukms = useQuery({ queryKey: qk.corpus.hukms, queryFn: ({ signal }) => listHukms(signal), staleTime: Infinity })
  const hukmName = (id: number) => {
    const h = hukms.data?.find((x) => x.id === id)
    return t('search.filters.hukmChip', { name: h?.label ?? h?.arabic_name ?? h?.name ?? `#${id}` })
  }

  const remove = useMutation({
    mutationFn: (id: number) => deletePersonalSearch(id),
    onSuccess: async () => {
      setDialog(null)
      await invalidate.savedSearchesChanged(qc)
    },
    onError: () => setDialog(null),
  })

  const items = list.data?.items ?? []
  const current = dialog ? items.find((s) => s.id === dialog.id) : undefined
  const total = list.data?.pagination?.total_items ?? items.length

  return (
    <section>
      <div className={styles.pageHead}>
        <div>
          <h1>{t('savedSearches.title')}</h1>
          <p className={styles.hint}>{t('savedSearches.intro')}</p>
        </div>
        {list.data ? <p className={styles.hint}>{t('savedSearches.count', { count: total, formattedCount: n(total) })}</p> : null}
      </div>

      <MutationNotice error={remove.error} title={t('savedSearches.delete.failed')} />

      <StateBoundary
        state={viewStateOf(list, { isEmpty: (d) => (d as { items: unknown[] }).items.length === 0 })}
        errorValue={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <div className={styles.empty}>
            <h2>{t('savedSearches.empty.title')}</h2>
            <p>{t('savedSearches.empty.body')}</p>
          </div>
        }
      >
        <ul className={styles.cards}>
          {items.map((s) => {
            const def = definitionOf(s)
            const filters = filterParts(def, { hukm: hukmName, narrator: (name) => t('search.filters.narratorChip', { name }) })
            return (
              <li key={s.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.code}>{queryCode(s.id)}</span>
                  <span className={styles.hint}>{t(`search.form.modes.${def.mode}`)}</span>
                </div>
                <strong>
                  <BidiText>{s.name}</BidiText>
                </strong>
                <BidiText as="div" className={styles.text}>
                  {s.query_text}
                </BidiText>
                {filters.length > 0 ? <div className={styles.hint}>{filters.join(' · ')}</div> : null}
                {s.created_at ? <div className={styles.hint}>{t('savedSearches.saved', { when: relative(s.created_at) })}</div> : null}
                <div className={styles.actions}>
                  <Button variant="primary" onClick={() => setDialog({ kind: 'open', id: s.id })} aria-label={`${t('savedSearches.open.action')} ${s.name}`}>
                    {t('savedSearches.open.action')}
                  </Button>
                  <Button onClick={() => setDialog({ kind: 'rename', id: s.id })} aria-label={`${t('savedSearches.rename.action')} ${s.name}`}>
                    {t('savedSearches.rename.action')}
                  </Button>
                  <Button variant="ghost" onClick={() => setDialog({ kind: 'delete', id: s.id })} aria-label={`${t('savedSearches.delete.action')} ${s.name}`}>
                    {t('savedSearches.delete.action')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
        {list.data?.pagination ? <Pagination pagination={list.data.pagination} onPage={(page) => url.set({ page })} /> : null}
      </StateBoundary>

      <p className={styles.hint}>{t('savedSearches.runNote')}</p>

      {dialog?.kind === 'open' && current ? <OpenInProjectDialog search={current} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'rename' && current ? <RenameSearchDialog search={current} onClose={() => setDialog(null)} /> : null}
      <ConfirmAction
        open={dialog?.kind === 'delete' && !!current}
        danger
        title={t('savedSearches.delete.title', { name: current?.name ?? '' })}
        confirmLabel={t('savedSearches.delete.confirm')}
        busy={remove.isPending}
        onCancel={() => setDialog(null)}
        onConfirm={() => current && remove.mutate(current.id)}
      >
        <p>{t('savedSearches.delete.body')}</p>
      </ConfirmAction>
    </section>
  )
}
