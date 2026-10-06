import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getNarrator, getNarratorCriticism } from '@/api/corpus'
import { qk } from '@/api/queryKeys'
import { NeutralState, ProvenanceTag } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Pagination } from '@/components/Pagination'
import { narratorCode } from './comparisonModel'
import styles from './Comparison.module.css'

/**
 * What critics said about one narrator, in their exact words, from the corpus. The category the design calls the
 * normalized label is not provided by the corpus, so each statement says so and is never given one.
 */
export function NarratorStatements({ narratorId }: { narratorId: number }) {
  const { t } = useTranslation()
  // Which page of this narrator's list is open is a view detail of this list, not something to share by link.
  const [page, setPage] = useState(1)

  const narrator = useQuery({
    queryKey: qk.corpus.narrator(narratorId),
    queryFn: ({ signal }) => getNarrator(narratorId, signal),
  })
  const statements = useQuery({
    queryKey: qk.corpus.criticism(narratorId, page),
    queryFn: ({ signal }) => getNarratorCriticism(narratorId, page, signal),
    placeholderData: (previous) => previous,
  })

  const name = narrator.data?.name ?? narratorCode(narratorId)
  return (
    <section aria-label={t('comparison.crit.statementsOf', { name })}>
      <h3>
        {t('comparison.crit.statementsHeading')} <BidiText>{name}</BidiText>
      </h3>
      {statements.isPending ? <p role="status">{t('states.loading.label')}</p> : null}
      {statements.isError ? <p role="alert">{t('comparison.dossier.criticismFailed')}</p> : null}
      {statements.data && statements.data.data.length === 0 ? (
        <NeutralState kind="unknown">{t('comparison.dossier.noCriticism')}</NeutralState>
      ) : null}
      {statements.data && statements.data.data.length > 0 ? (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('comparison.crit.critic')}</th>
                <th scope="col">{t('comparison.crit.qawl')}</th>
                <th scope="col">{t('comparison.crit.source')}</th>
                <th scope="col">{t('comparison.crit.label')}</th>
              </tr>
            </thead>
            <tbody>
              {statements.data.data.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    <BidiText>{c.scholar?.name ?? ''}</BidiText>
                    {c.scholar?.deathdate ? (
                      <span className={styles.hint}>
                        {' '}
                        ·{' '}
                        {t('comparison.crit.died', {
                          value: c.scholar.deathdate,
                        })}
                      </span>
                    ) : null}
                  </th>
                  <td>
                    <ProvenanceTag kind="attributed" name={c.scholar?.name} />
                    <BidiText as="p" className={styles.qawl}>
                      {c.qawl}
                    </BidiText>
                  </td>
                  <td>
                    <NeutralState kind="unknown">{t('comparison.crit.noSource')}</NeutralState>
                  </td>
                  <td>
                    <NeutralState kind="unknown">{t('comparison.crit.noLabel')}</NeutralState>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.hint}>{t('comparison.crit.wordingNote')}</p>
          {statements.data.pagination ? <Pagination pagination={statements.data.pagination} onPage={setPage} /> : null}
        </>
      ) : null}
    </section>
  )
}
