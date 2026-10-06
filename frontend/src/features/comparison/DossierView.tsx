import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { getNarrator, getNarratorCriticism, getNarratorLinks } from '@/api/corpus'
import { qk } from '@/api/queryKeys'
import type { CorpusNarrator } from '@/api/schemas/corpus'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState, ProvenanceTag } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { narratorCode } from './comparisonModel'
import { NarratorPicker } from './NarratorPicker'
import { useChainsOfReports } from './useComparison'
import styles from './Comparison.module.css'

interface Props {
  projectId: number
  narratorId: number | undefined
  /** The reports being compared, to say in how many of their chains the narrator stands. */
  reportIds: number[]
  onPick: (id: number) => void
  onCompareCriticism: (id: number) => void
}

const known = (value: string | null | undefined): string | null => (value && value.trim() ? value : null)

/** One narrator as the corpus records them: identity, who they heard from and taught, and what critics said. */
export function DossierView({ projectId, narratorId, reportIds, onPick, onCompareCriticism }: Props) {
  const { t } = useTranslation()
  const { n } = usePreferences()

  const narrator = useQuery({
    queryKey: qk.corpus.narrator(narratorId ?? 0),
    queryFn: ({ signal }) => getNarrator(narratorId!, signal),
    enabled: narratorId !== undefined,
    retry: false,
  })
  const teachers = useQuery({
    queryKey: qk.corpus.narratorLinks(narratorId ?? 0, 'teachers'),
    queryFn: ({ signal }) => getNarratorLinks(narratorId!, 'teachers', signal),
    enabled: narratorId !== undefined,
  })
  const students = useQuery({
    queryKey: qk.corpus.narratorLinks(narratorId ?? 0, 'students'),
    queryFn: ({ signal }) => getNarratorLinks(narratorId!, 'students', signal),
    enabled: narratorId !== undefined,
  })
  const criticism = useQuery({
    queryKey: qk.corpus.criticism(narratorId ?? 0, 1),
    queryFn: ({ signal }) => getNarratorCriticism(narratorId!, 1, signal),
    enabled: narratorId !== undefined,
  })
  const { compare } = useChainsOfReports(projectId, reportIds)

  if (narratorId === undefined) {
    return (
      <div className={styles.empty}>
        <h2>{t('comparison.empty.dossier.title')}</h2>
        <p>{t('comparison.empty.dossier.body')}</p>
        <NarratorPicker onPick={(picked) => onPick(picked.id)} />
      </div>
    )
  }

  const chains = compare.data
  const inChains = chains ? chains.chains.filter((c) => c.narrators.some((x) => x.narrator_id === narratorId)).length : null

  return (
    <StateBoundary state={viewStateOf(narrator)} errorValue={narrator.error} onRetry={() => void narrator.refetch()}>
      {narrator.data ? (
        <article className={styles.dossier} aria-label={narrator.data.name}>
          <header>
            <p className={styles.code}>
              {t('comparison.dossier.kicker', {
                code: narratorCode(narrator.data.id),
              })}
            </p>
            <h2>
              <BidiText>{narrator.data.name}</BidiText>
            </h2>
            <NarratorPicker exclude={[narrator.data.id]} onPick={(picked) => onPick(picked.id)} />
          </header>

          <section aria-label={t('comparison.dossier.identity')}>
            <h2>{t('comparison.dossier.identity')}</h2>
            <Identity narrator={narrator.data} />
          </section>

          <section aria-label={t('comparison.dossier.links')}>
            <h2>{t('comparison.dossier.links')}</h2>
            <LinkList kind="teachers" total={narrator.data.shyookh_count} query={teachers} />
            <LinkList kind="students" total={narrator.data.students_count} query={students} />
            <p className={styles.hint}>{t('comparison.dossier.linksNote')}</p>
          </section>

          <section aria-label={t('comparison.dossier.criticism')}>
            <h2>{t('comparison.dossier.criticism')}</h2>
            {criticism.isPending ? <p role="status">{t('states.loading.label')}</p> : null}
            {criticism.isError ? <p role="alert">{t('comparison.dossier.criticismFailed')}</p> : null}
            {criticism.data && criticism.data.data.length === 0 ? (
              <NeutralState kind="unknown">{t('comparison.dossier.noCriticism')}</NeutralState>
            ) : null}
            <ul className={styles.stored}>
              {(criticism.data?.data ?? []).slice(0, 3).map((c) => (
                <li key={c.id}>
                  <ProvenanceTag kind="attributed" name={c.scholar?.name} />
                  <BidiText as="p" className={styles.qawl}>
                    {c.qawl}
                  </BidiText>
                </li>
              ))}
            </ul>
            <Button onClick={() => onCompareCriticism(narrator.data.id)}>{t('comparison.dossier.compareCriticism')}</Button>
          </section>

          <section aria-label={t('comparison.dossier.related')}>
            <h2>{t('comparison.dossier.related')}</h2>
            {inChains !== null && chains ? (
              <p>
                {t('comparison.dossier.inChains', {
                  count: inChains,
                  total: chains.chain_count,
                  formattedCount: n(inChains),
                  formattedTotal: n(chains.chain_count),
                })}
              </p>
            ) : (
              <p className={styles.hint}>{t('comparison.dossier.noChains')}</p>
            )}
            {narrator.data.transmissions_count !== undefined ? (
              <p>
                {t('comparison.dossier.transmissions', {
                  count: narrator.data.transmissions_count,
                  formattedCount: n(narrator.data.transmissions_count),
                })}
              </p>
            ) : null}
          </section>
        </article>
      ) : null}
    </StateBoundary>
  )
}

export function Identity({ narrator }: { narrator: CorpusNarrator }) {
  const { t } = useTranslation()
  const value = (text: string | null | undefined, wrap = true): ReactNode =>
    known(text) ? wrap ? <BidiText>{text!}</BidiText> : text : <NeutralState kind="unknown" />
  const generation = typeof narrator.tabaqah === 'string' ? narrator.tabaqah : null
  return (
    <dl className={styles.facts}>
      <dt>{t('comparison.dossier.fields.name')}</dt>
      <dd>{value(narrator.name)}</dd>
      <dt>{t('comparison.dossier.fields.kunya')}</dt>
      <dd>{value(narrator.kunya)}</dd>
      <dt>{t('comparison.dossier.fields.laqab')}</dt>
      <dd>{value(narrator.laqab)}</dd>
      <dt>{t('comparison.dossier.fields.nasab')}</dt>
      <dd>{value(narrator.nasab)}</dd>
      <dt>{t('comparison.dossier.fields.shohra')}</dt>
      <dd>{value(narrator.shohra)}</dd>
      <dt>{t('comparison.dossier.fields.birth')}</dt>
      <dd>{value(narrator.birthdate, false)}</dd>
      <dt>{t('comparison.dossier.fields.death')}</dt>
      <dd>{value(narrator.deathdate, false)}</dd>
      <dt>{t('comparison.dossier.fields.generation')}</dt>
      <dd>{value(generation, false)}</dd>
      <dt>{t('comparison.dossier.fields.rank')}</dt>
      <dd>{value(narrator.rutba_description)}</dd>
      <dt>{t('comparison.dossier.fields.tadlis')}</dt>
      <dd>
        {narrator.tadlis ? (
          t('comparison.dossier.recorded')
        ) : (
          <NeutralState kind="unknown">{t('comparison.dossier.notRecorded')}</NeutralState>
        )}
      </dd>
      <dt>{t('comparison.dossier.fields.ikhtilat')}</dt>
      <dd>
        {narrator.has_ikhtilat ? (
          t('comparison.dossier.recorded')
        ) : (
          <NeutralState kind="unknown">{t('comparison.dossier.notRecorded')}</NeutralState>
        )}
      </dd>
    </dl>
  )
}

function LinkList({
  kind,
  total,
  query,
}: {
  kind: 'teachers' | 'students'
  total: number | undefined
  query: {
    isPending: boolean
    isError: boolean
    data?: { data: CorpusNarrator[] }
  }
}) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const shown = query.data?.data ?? []
  const count = total ?? shown.length
  return (
    <div>
      <h3>{t(`comparison.dossier.${kind}`, { count, formattedCount: n(count) })}</h3>
      {query.isPending ? <p role="status">{t('states.loading.label')}</p> : null}
      {query.isError ? <p role="alert">{t('comparison.dossier.linksFailed')}</p> : null}
      <p>
        {shown.map((s, i) => (
          <span key={s.id}>
            {i > 0 ? ' · ' : ''}
            <BidiText>{s.name}</BidiText>
          </span>
        ))}
        {count > shown.length
          ? ` · ${t('comparison.dossier.more', { count: count - shown.length, formattedCount: n(count - shown.length) })}`
          : ''}
      </p>
    </div>
  )
}
