import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { getEditorSubmission } from '@/api/editorial'
import { qk } from '@/api/queryKeys'
import { useAuth } from '@/app/authContext'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { AssignDialog } from './AssignDialog'
import { DecisionForm } from './DecisionForm'
import { canDecide, canRelease, caseStage } from './editorialModel'
import { CorrigendumDialog, ReleaseDialog, RetractDialog } from './PublicationDialogs'
import styles from './Editorial.module.css'

type Dialog = 'assign' | 'release' | 'corrigendum' | 'retract' | null

/**
 * Screen 22, one package. What an editor sees: the package's details, every review with who wrote it, the decision, and
 * the next step the workflow allows. A person who is the owner or the submitter of this package cannot decide on it or
 * assign a reviewer to it (the server refuses too, and also refuses project members, which the screen cannot know).
 */
export function CasePage() {
  const { t } = useTranslation()
  const { date, n } = usePreferences()
  const { user } = useAuth()
  const { submissionId } = useParams()
  const id = Number(submissionId)
  const [dialog, setDialog] = useState<Dialog>(null)

  const query = useQuery({ queryKey: qk.editor.submission(id), queryFn: ({ signal }) => getEditorSubmission(id, signal), enabled: Number.isInteger(id) && id > 0, retry: false })
  const s = query.data
  const view = s ? 'normal' : Number.isInteger(id) && id > 0 ? viewStateOf(query) : 'forbidden'

  const code = formatCode('SUB', id)
  const stage = s ? caseStage(s) : 'other'
  const conflicted = !!s && !!user && (s.submitter?.id === user.id || s.project?.owner?.id === user.id)
  const pub = s?.publication

  return (
    <section>
      <p>
        <Link to="/editor">{t('editorial.back')}</Link>
      </p>
      <StateBoundary
        state={view}
        errorValue={query.error}
        onRetry={() => void query.refetch()}
        forbidden={
          <div className={styles.empty}>
            <h1>{t('editorial.case.unavailableTitle')}</h1>
            <p>{t('editorial.case.unavailableBody')}</p>
          </div>
        }
      >
        <RefreshNotice query={query} what={code} />
        {s ? (
          <>
            <div className={styles.head}>
              <div>
                <p className={styles.sub}>
                  <span className="mono">{code}</span> · {t('editorial.table.version', { version: n(s.version_number) })}
                  {s.project?.id ? <> · <span className="mono">{formatCode('PRJ', s.project.id)}</span></> : null}
                  {s.project?.owner?.display_name ? <> · {t('editorial.case.owner')} <BidiText>{s.project.owner.display_name}</BidiText></> : null}
                </p>
                <h1>
                  <BidiText>{s.title}</BidiText>
                </h1>
              </div>
              <span className={styles.stage}>{t(`editorial.stages.${stage}`)}</span>
            </div>

            {conflicted ? (
              <p>
                <NeutralState kind="limitation">{t('editorial.case.conflicted')}</NeutralState>
              </p>
            ) : null}

            <div className={styles.layout}>
              <div>
                <section className={styles.panel} aria-label={t('editorial.case.package')}>
                  <h2>{t('editorial.case.package')}</h2>
                  <dl className={styles.facts}>
                    <dt>{t('editorial.case.abstract')}</dt>
                    <dd>{s.abstract ? <BidiText>{s.abstract}</BidiText> : '—'}</dd>
                    <dt>{t('editorial.case.keywords')}</dt>
                    <dd>{(s.keywords ?? []).length > 0 ? <BidiText>{(s.keywords ?? []).join(' · ')}</BidiText> : '—'}</dd>
                    <dt>{t('editorial.case.rights')}</dt>
                    <dd>{s.rights_declaration ?? '—'}</dd>
                    <dt>{t('editorial.case.submitted')}</dt>
                    <dd>
                      {s.submitted_at ? date(s.submitted_at, { time: true }) : '—'}
                      {s.submitter?.display_name ? <> · <BidiText>{s.submitter.display_name}</BidiText></> : null}
                    </dd>
                    <dt>{t('editorial.case.checksum')}</dt>
                    <dd className={styles.mono}>{s.package_checksum ?? '—'}</dd>
                  </dl>
                  {s.author_response_notes ? (
                    <p>
                      <strong>{t('editorial.case.response')}</strong> <BidiText>{s.author_response_notes}</BidiText>
                    </p>
                  ) : null}
                </section>

                <section className={styles.panel} aria-label={t('editorial.case.reviews')}>
                  <h2>{t('editorial.case.reviews')}</h2>
                  {(s.reviews ?? []).length === 0 ? <p className={styles.meta}>{t('editorial.case.noReviews')}</p> : null}
                  {(s.reviews ?? []).map((r) => (
                    <div key={r.id} className={styles.review}>
                      <strong>
                        <BidiText>{r.reviewer?.display_name ?? `#${r.reviewer_id ?? r.id}`}</BidiText>
                      </strong>{' '}
                      {r.completed_at ? (
                        <span className={styles.meta}>
                          {t(`editorial.case.recommendation.${r.recommendation ?? 'none'}`, { defaultValue: r.recommendation ?? '' })}
                          {r.score ? ` · ${t('editorial.case.score', { score: n(r.score) })}` : ''} · {date(r.completed_at)}
                        </span>
                      ) : (
                        <span className={styles.meta}>
                          {t('editorial.case.waitingReview')}
                          {r.due_date ? ` · ${t('editorial.case.due', { date: date(r.due_date) })}` : ''}
                        </span>
                      )}
                      {r.reviewer_notes ? (
                        <p>
                          <BidiText>{r.reviewer_notes}</BidiText>
                        </p>
                      ) : null}
                    </div>
                  ))}
                </section>

                {s.decision?.decision ? (
                  <section className={styles.panel} aria-label={t('editorial.case.decision')}>
                    <h2>{t('editorial.case.decision')}</h2>
                    <p>
                      {t(`editorial.decide.options.${s.decision.decision}`, { defaultValue: s.decision.decision })}
                      {s.decision.editor?.display_name ? <> · <BidiText>{s.decision.editor.display_name}</BidiText></> : null}
                      {s.decision.decided_at ? ` · ${date(s.decision.decided_at)}` : ''}
                    </p>
                    {s.decision.decision_notes ? (
                      <p>
                        <BidiText>{s.decision.decision_notes}</BidiText>
                      </p>
                    ) : null}
                  </section>
                ) : null}
              </div>

              <div>
                {pub ? (
                  <section className={styles.panel} aria-label={t('editorial.publication.title')}>
                    <h2>{t('editorial.publication.title')}</h2>
                    <dl className={styles.facts}>
                      <dt>{t('editorial.publication.status')}</dt>
                      <dd>{t(`editorial.publication.states.${pub.status ?? 'published'}`, { defaultValue: pub.status ?? '' })}</dd>
                      <dt>{t('editorial.release.slug')}</dt>
                      <dd className={styles.mono}>{pub.public_slug}</dd>
                      <dt>{t('editorial.release.version')}</dt>
                      <dd>{pub.version_string}</dd>
                      <dt>{t('editorial.release.doi')}</dt>
                      <dd className={styles.mono}>{pub.doi ?? '—'}</dd>
                      <dt>{t('editorial.release.licence')}</dt>
                      <dd>{pub.license ?? '—'}</dd>
                      {pub.released_at ? (
                        <>
                          <dt>{t('editorial.publication.released')}</dt>
                          <dd>{date(pub.released_at, { time: true })}</dd>
                        </>
                      ) : null}
                    </dl>
                    {(pub.corrigenda ?? []).length > 0 ? (
                      <>
                        <h3>{t('editorial.publication.corrigenda')}</h3>
                        <ul>
                          {(pub.corrigenda ?? []).map((c, i) => (
                            <li key={c.id ?? i}>
                              {c.new_version ? <strong>{c.new_version}</strong> : null} <BidiText>{c.notice ?? ''}</BidiText>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    {pub.retraction_reason ? (
                      <p>
                        <strong>{t('editorial.publication.retractedBecause')}</strong> <BidiText>{pub.retraction_reason}</BidiText>
                      </p>
                    ) : null}
                    {pub.status !== 'retracted' ? (
                      <div className={styles.actions}>
                        <Button onClick={() => setDialog('corrigendum')}>{t('editorial.corrigendum.open')}</Button>
                        <Button variant="danger" onClick={() => setDialog('retract')}>
                          {t('editorial.retract.open')}
                        </Button>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {!conflicted && canDecide(s) ? (
                  <>
                    <section className={styles.panel} aria-label={t('editorial.assign.title')}>
                      <h2>{t('editorial.assign.title')}</h2>
                      <p className={styles.meta}>{t('editorial.assign.intro')}</p>
                      <Button onClick={() => setDialog('assign')}>{t('editorial.assign.open')}</Button>
                    </section>
                    <DecisionForm key={`${s.id}-${s.status}-${(s.reviews ?? []).length}`} submission={s} />
                  </>
                ) : null}

                {!conflicted && canRelease(s) ? (
                  <section className={styles.panel} aria-label={t('editorial.release.title', { code })}>
                    <h2>{t('editorial.release.title', { code })}</h2>
                    <p>{t('editorial.release.approved')}</p>
                    <Button variant="primary" onClick={() => setDialog('release')}>
                      {t('editorial.release.open')}
                    </Button>
                  </section>
                ) : null}

                {!canDecide(s) && !canRelease(s) && !pub ? <p className={styles.note}>{t('editorial.case.nothingToDo')}</p> : null}
              </div>
            </div>

            {dialog === 'assign' ? <AssignDialog submission={s} onClose={() => setDialog(null)} /> : null}
            {dialog === 'release' ? <ReleaseDialog submission={s} onClose={() => setDialog(null)} /> : null}
            {dialog === 'corrigendum' && pub ? <CorrigendumDialog submissionId={s.id} publicationId={pub.id} current={pub.version_string ?? ''} onClose={() => setDialog(null)} /> : null}
            {dialog === 'retract' && pub ? <RetractDialog submissionId={s.id} publicationId={pub.id} onClose={() => setDialog(null)} /> : null}
          </>
        ) : null}
      </StateBoundary>
    </section>
  )
}
