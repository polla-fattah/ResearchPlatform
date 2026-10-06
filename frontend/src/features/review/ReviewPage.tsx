import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { acceptAssignment, declareNoConflict, declineAssignment, getAssignment, submitReview } from '@/api/reviews'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import { RECOMMENDATIONS, type Recommendation } from '@/api/schemas/review'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Field } from '@/components/Field'
import { MutationNotice } from '@/components/MutationNotice'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { MarkdownPreview } from '@/features/writing/MarkdownPreview'
import { assignmentState, canSubmitReview, citationCount, MIN_NOTES, SCORES } from './reviewModel'
import styles from './Review.module.css'

/**
 * Screen 23, one package to review. Before reading, the reviewer declares they know of no conflict (or declines). Then
 * the package: what the authors froze, with no word of who they are, and one form for the review. The reviewer sees only
 * this package, never the project; the server also restricts the route to their own assignments. A finished review is
 * shown as it was sent and is not offered for change.
 */
export function ReviewPage() {
  const { t } = useTranslation()
  const { date, n } = usePreferences()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { assignmentId } = useParams()
  const id = Number(assignmentId)
  const valid = Number.isInteger(id) && id > 0
  const [opened, setOpened] = useState(false)
  const [conflictFree, setConflictFree] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [confirming, setConfirming] = useState(false)

  const query = useQuery({ queryKey: qk.reviews.one(id), queryFn: ({ signal }) => getAssignment(id, signal), enabled: valid, retry: false })
  const a = query.data
  const view = a ? 'normal' : valid ? viewStateOf(query) : 'forbidden'

  const open = useMutation({
    mutationFn: async () => {
      await declareNoConflict(id)
      await acceptAssignment(id)
    },
    onSuccess: () => setOpened(true),
  })
  const decline = useMutation({
    mutationFn: () => declineAssignment(id),
    onSuccess: async () => {
      await invalidate.reviewsChanged(qc)
      navigate('/review', { replace: true })
    },
  })
  const send = useMutation({
    mutationFn: () => submitReview(id, { recommendation: recommendation!, score: score ?? undefined, reviewer_notes: notes.trim() }),
    onSuccess: async () => {
      await invalidate.reviewsChanged(qc)
      setConfirming(false)
    },
  })

  const pack = a?.submission?.frozen_package
  const done = a ? assignmentState(a) === 'submitted' : false
  const reading = !!a && (done || opened)

  return (
    <section>
      <p>
        <Link to="/review">{t('review.back')}</Link>
      </p>
      <StateBoundary
        state={view}
        errorValue={query.error}
        onRetry={() => void query.refetch()}
        forbidden={
          <div className={styles.empty}>
            <h1>{t('review.unavailableTitle')}</h1>
            <p>{t('review.unavailableBody')}</p>
          </div>
        }
      >
        <RefreshNotice query={query} what={t('review.packageName')} />
        {a?.submission ? (
          <>
            <div className={styles.head}>
              <p className={styles.sub}>
                <span className="mono">{formatCode('SUB', a.submission.id)}</span>
                {a.submission.version_number ? ` · ${t('review.table.version', { version: n(a.submission.version_number) })}` : ''}
                {a.due_date && !done ? ` · ${t('review.dueOn', { date: date(a.due_date) })}` : ''}
              </p>
              <h1>
                <BidiText>{a.submission.title}</BidiText>
              </h1>
            </div>

            {!reading ? (
              <section className={styles.gate} aria-label={t('review.gate.title')}>
                <h2>{t('review.gate.title')}</h2>
                <p>{t('review.gate.intro')}</p>
                <ul>
                  {(['coauthor', 'institution', 'supervision', 'financial', 'other'] as const).map((k) => (
                    <li key={k}>{t(`review.gate.items.${k}`)}</li>
                  ))}
                </ul>
                <label className={styles.radio}>
                  <input type="checkbox" checked={conflictFree} onChange={(e) => setConflictFree(e.target.checked)} /> {t('review.gate.confirm')}
                </label>
                <p className={styles.meta}>{t('review.gate.note')}</p>
                <MutationNotice error={open.error} title={t('review.gate.failed')} />
                <div className={styles.actions}>
                  <Button variant="primary" onClick={() => open.mutate()} disabled={!conflictFree || open.isPending}>
                    {t('review.gate.open')}
                  </Button>
                  <Button onClick={() => setDeclining(true)}>{t('review.gate.decline')}</Button>
                </div>
              </section>
            ) : (
              <div className={styles.layout}>
                <div>
                  <section className={styles.panel} aria-label={t('review.package.abstract')}>
                    <h2>{t('review.package.abstract')}</h2>
                    <p className={styles.notes}>
                      <BidiText>{pack?.abstract ?? a.submission.abstract ?? ''}</BidiText>
                    </p>
                    <p className={styles.meta}>
                      {t('review.package.included', {
                        documents: n((pack?.documents ?? []).length),
                        findings: n((pack?.findings ?? []).length),
                        citations: n(citationCount(pack)),
                      })}
                    </p>
                    <p className={styles.meta}>{t('review.package.notIncluded')}</p>
                  </section>

                  {(pack?.documents ?? []).map((d) => (
                    <section key={d.id} className={[styles.panel, styles.doc].join(' ')} aria-label={d.title}>
                      <h2>
                        <BidiText>{d.title}</BidiText>
                      </h2>
                      <MarkdownPreview text={d.latest_version?.content ?? ''} empty={t('review.package.noContent')} />
                    </section>
                  ))}

                  <section className={styles.panel} aria-label={t('review.package.findings')}>
                    <h2>{t('review.package.findings')}</h2>
                    {(pack?.findings ?? []).length === 0 ? <p className={styles.meta}>{t('review.package.noFindings')}</p> : null}
                    {(pack?.findings ?? []).map((f) => (
                      <div key={f.id} className={styles.finding}>
                        <strong>
                          <BidiText>{f.claim}</BidiText>
                        </strong>
                        {f.status ? <span className={styles.meta}> · {t(`review.package.findingStatus.${f.status}`, { defaultValue: f.status })}</span> : null}
                        {f.reasoning ? (
                          <p>
                            <BidiText>{f.reasoning}</BidiText>
                          </p>
                        ) : null}
                        {f.limitations ? (
                          <p className={styles.meta}>
                            {t('review.package.limitations')}: <BidiText>{f.limitations}</BidiText>
                          </p>
                        ) : (
                          <p className={styles.meta}>{t('review.package.noLimitations')}</p>
                        )}
                        <p className={styles.meta}>{t('review.package.evidenceCount', { count: (f.evidence_items ?? []).length, formattedCount: n((f.evidence_items ?? []).length) })}</p>
                      </div>
                    ))}
                  </section>
                </div>

                <div>
                  {done ? (
                    <section className={styles.done} role="status" aria-label={t('review.sent.title')}>
                      <h2>{t('review.sent.title')}</h2>
                      <p>
                        {t(`review.options.${a.recommendation ?? 'approve'}`, { defaultValue: a.recommendation ?? '' })}
                        {a.score ? ` · ${t('review.sent.score', { score: n(a.score) })}` : ''}
                        {a.completed_at ? ` · ${date(a.completed_at)}` : ''}
                      </p>
                      {a.reviewer_notes ? (
                        <p className={styles.notes}>
                          <BidiText>{a.reviewer_notes}</BidiText>
                        </p>
                      ) : null}
                      <p className={styles.meta}>{t('review.sent.note')}</p>
                    </section>
                  ) : (
                    <form
                      className={styles.panel}
                      aria-label={t('review.form.title')}
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (canSubmitReview({ recommendation, notes, score })) setConfirming(true)
                      }}
                    >
                      <h2>{t('review.form.title')}</h2>
                      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                        <legend>{t('review.form.recommendation')}</legend>
                        {RECOMMENDATIONS.map((r) => (
                          <label key={r} className={styles.radio}>
                            <input type="radio" name="recommendation" value={r} checked={recommendation === r} onChange={() => setRecommendation(r)} /> {t(`review.options.${r}`)}
                          </label>
                        ))}
                      </fieldset>
                      <Field label={t('review.form.score')} requirement="optional">
                        <select value={score ?? ''} onChange={(e) => setScore(e.target.value ? Number(e.target.value) : null)}>
                          <option value="">{t('review.form.noScore')}</option>
                          {SCORES.map((s) => (
                            <option key={s} value={s}>
                              {n(s)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label={t('review.form.notes')}
                        requirement="required"
                        hint={t('review.form.notesHint', { min: MIN_NOTES })}
                        error={notes.trim().length > 0 && notes.trim().length < MIN_NOTES ? t('review.form.notesShort', { min: MIN_NOTES }) : undefined}
                      >
                        <textarea rows={8} dir="auto" value={notes} onChange={(e) => setNotes(e.target.value)} />
                      </Field>
                      <p className={styles.meta}>{t('review.form.note')}</p>
                      <MutationNotice error={send.error} title={t('review.form.failed')} />
                      <Button type="submit" variant="primary" disabled={!canSubmitReview({ recommendation, notes, score }) || send.isPending}>
                        {t('review.form.submit')}
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            )}

            <ConfirmAction
              open={declining}
              danger
              busy={decline.isPending}
              title={t('review.decline.title')}
              confirmLabel={t('review.decline.confirm')}
              onConfirm={() => decline.mutate()}
              onCancel={() => setDeclining(false)}
            >
              <p>{t('review.decline.body')}</p>
              <MutationNotice error={decline.error} title={t('review.decline.failed')} />
            </ConfirmAction>
            {confirming ? (
              <ConfirmAction open busy={send.isPending} title={t('review.confirm.title')} confirmLabel={t('review.confirm.action')} onConfirm={() => send.mutate()} onCancel={() => setConfirming(false)}>
                <p>{t('review.confirm.body')}</p>
                <p>
                  <strong>{recommendation ? t(`review.options.${recommendation}`) : ''}</strong>
                </p>
              </ConfirmAction>
            ) : null}
          </>
        ) : null}
      </StateBoundary>
    </section>
  )
}
