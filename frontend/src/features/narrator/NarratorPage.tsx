import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { getNarrator, getNarratorCriticism } from '@/api/corpus'
import { getTrajectory } from '@/api/narratorDossier'
import { qk } from '@/api/queryKeys'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { narratorCode } from '@/features/comparison/comparisonModel'
import { Identity } from '@/features/comparison/DossierView'
import { NarratorPicker } from '@/features/comparison/NarratorPicker'
import { useProject } from '@/features/projects/useProject'
import { AssertionsPanel } from './AssertionsPanel'
import { AssessmentsPanel } from './AssessmentsPanel'
import { parseNarratorId, placeName, yearsLabel } from './narratorModel'
import styles from './Narrator.module.css'

/**
 * Screen 30. One narrator: who the corpus says they are, what critics said (word for word), where they lived, and what
 * THIS project holds about them (assertions, teacher-specific assessments). The design's lifetime chart and automatic
 * "possible contact" checks need dated, sourced assertions; the server has neither, so they are not drawn and nothing
 * here computes a result from text (request file C-37).
 */
export function NarratorPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id: projectId, can } = useProject()
  const narratorId = parseNarratorId(useParams().narratorId)
  if (projectId === null) return null
  const base = `/projects/${projectId}/analysis/narrators`

  if (narratorId === null) {
    return (
      <section aria-label={t('narrator.title')}>
        <h1>{t('narrator.title')}</h1>
        <p>{t('narrator.choose')}</p>
        <NarratorPicker onPick={(n) => void navigate(`${base}/${n.id}`)} />
      </section>
    )
  }
  return <Dossier projectId={projectId} narratorId={narratorId} canEdit={can('editShared')} onPick={(id) => void navigate(`${base}/${id}`)} />
}

function Dossier({ projectId, narratorId, canEdit, onPick }: { projectId: number; narratorId: number; canEdit: boolean; onPick: (id: number) => void }) {
  const { t, i18n } = useTranslation()
  const narrator = useQuery({ queryKey: qk.corpus.narrator(narratorId), queryFn: ({ signal }) => getNarrator(narratorId, signal), retry: false })
  const criticism = useQuery({ queryKey: qk.corpus.criticism(narratorId, 1), queryFn: ({ signal }) => getNarratorCriticism(narratorId, 1, signal) })
  const trajectory = useQuery({ queryKey: qk.corpus.trajectory(narratorId), queryFn: ({ signal }) => getTrajectory(narratorId, signal) })
  const view = narrator.data ? 'normal' : viewStateOf(narrator)
  const n = narrator.data

  return (
    <section aria-label={t('narrator.title')}>
      <StateBoundary state={view} errorValue={narrator.error} onRetry={() => void narrator.refetch()}>
        <RefreshNotice query={narrator} what={t('narrator.title')} />
        {n ? (
          <>
            <p className={styles.meta}>
              <span className="mono">{narratorCode(n.id)}</span> · {t('narrator.title')}
            </p>
            <h1>
              <BidiText>{n.name}</BidiText>
            </h1>
            <p className={styles.note} role="note">
              {t('narrator.unchecked')}
            </p>
            <Identity narrator={n} />

            <AssertionsPanel projectId={projectId} narratorId={narratorId} narratorName={n.name} canEdit={canEdit} />
            <AssessmentsPanel projectId={projectId} narratorId={narratorId} canEdit={canEdit} />

            <section className={styles.section} aria-labelledby="criticism-h">
              <h2 id="criticism-h">{t('narrator.criticism.title')}</h2>
              <p className={styles.meta}>{t('narrator.criticism.note')}</p>
              {criticism.isPending ? <p role="status">{t('states.loading.label')}</p> : null}
              {criticism.isError ? <p role="alert">{t('narrator.criticism.failed')}</p> : null}
              {criticism.data && criticism.data.data.length === 0 ? <NeutralState kind="unknown">{t('narrator.criticism.none')}</NeutralState> : null}
              {criticism.data && criticism.data.data.length > 0 ? (
                <ul className={styles.members} aria-label={t('narrator.criticism.title')}>
                  {criticism.data.data.map((c) => (
                    <li key={c.id} className={styles.member}>
                      <div>
                        <p>
                          <BidiText>{c.qawl}</BidiText>
                        </p>
                        <p className={styles.meta}>
                          {c.scholar?.name ? <BidiText>{c.scholar.name}</BidiText> : <NeutralState kind="unknown">{t('narrator.criticism.noScholar')}</NeutralState>}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className={styles.section} aria-labelledby="trajectory-h">
              <h2 id="trajectory-h">{t('narrator.trajectory.title')}</h2>
              <p className={styles.meta}>{t('narrator.trajectory.note')}</p>
              {trajectory.isPending ? <p role="status">{t('states.loading.label')}</p> : null}
              {trajectory.isError ? <p role="alert">{t('narrator.trajectory.failed')}</p> : null}
              {trajectory.data && trajectory.data.stops.length === 0 ? <NeutralState kind="unknown">{t('narrator.trajectory.none')}</NeutralState> : null}
              {trajectory.data && trajectory.data.stops.length > 0 ? (
                <table className={styles.table}>
                  <caption className="sr-only">{t('narrator.trajectory.title')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('narrator.trajectory.place')}</th>
                      <th scope="col">{t('narrator.trajectory.kind')}</th>
                      <th scope="col">{t('narrator.trajectory.years')}</th>
                      <th scope="col">{t('narrator.trajectory.basis')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trajectory.data.stops.map((s, i) => {
                      const place = placeName(s, i18n.language)
                      const years = yearsLabel(s)
                      return (
                        <tr key={i}>
                          <td>{place ? <BidiText>{place}</BidiText> : <NeutralState kind="unknown" />}</td>
                          <td>{s.type ? t(`narrator.trajectory.types.${s.type}`, { defaultValue: s.type }) : <NeutralState kind="unknown" />}</td>
                          <td>{years ? `${t('narrator.trajectory.ah')} ${years}` : <NeutralState kind="unknown" />}</td>
                          <td>
                            {s.is_inferred ? t('narrator.trajectory.inferred') : t('narrator.trajectory.stated')}
                            {s.evidence ? (
                              <>
                                {' · '}
                                <BidiText>{s.evidence}</BidiText>
                              </>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : null}
            </section>
          </>
        ) : null}
      </StateBoundary>
      <details>
        <summary>{t('narrator.another')}</summary>
        <NarratorPicker exclude={[narratorId]} onPick={(x) => onPick(x.id)} />
      </details>
    </section>
  )
}
