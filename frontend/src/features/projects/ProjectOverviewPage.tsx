import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { addMilestone, addQuestion, getProjectSummary, listMilestones, listQuestions, setStage } from '@/api/projectDetail'
import type { Milestone, ProjectQuestion, ProjectSummary } from '@/api/schemas/projectDetail'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ErrorSummary, Field } from '@/components/Field'
import { PROJECT_STAGES, EVIDENCE_STATES, type EvidenceState, type ProjectStage } from '@/domain/vocab'
import { hasQuestion } from '@/api/schemas/project'
import styles from './Projects.module.css'
import { useProject } from './useProject'
import { qk } from '@/api/queryKeys'
import { invalidate } from '@/api/invalidate'
import { errorMessage } from '@/api/errorMessage'

const SEG: Record<EvidenceState, string> = {
  candidate: styles.segCandidate!,
  included: styles.segIncluded!,
  reviewed: styles.segReviewed!,
  excluded: styles.segExcluded!,
  unresolved: styles.segUnresolved!,
}

export function ProjectOverviewPage() {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const { id, project, can } = useProject()

  const summary = useQuery({
    queryKey: qk.project(id ?? 0).summary,
    queryFn: ({ signal }) => getProjectSummary(id!, signal),
    enabled: id !== null,
    retry: false,
  })
  const milestones = useQuery({
    queryKey: qk.project(id ?? 0).milestones,
    queryFn: ({ signal }) => listMilestones(id!, signal),
    enabled: id !== null,
  })
  const questions = useQuery({
    queryKey: qk.project(id ?? 0).questions,
    queryFn: ({ signal }) => listQuestions(id!, signal),
    enabled: id !== null,
  })

  if (!project || id === null) return null
  const base = `/projects/${id}`
  const canEdit = can('editShared')
  const languages = (project.languages?.length ? project.languages : [project.primary_language ?? ''])
    .filter(Boolean)
    .map((l) => t(`projects.create.languages.${l}`, { defaultValue: l }))
    .join(', ')

  const s = summary.data
  const isEmpty =
    !!s &&
    s.evidence_counts.total === 0 &&
    s.resources_count === 0 &&
    s.saved_searches_count === 0 &&
    s.findings_count === 0

  return (
    <div className={styles.overviewGrid}>
      <div>
        <div className={styles.blockHead}>
          <span />
          {canEdit ? (
            <Link to={`${base}/copy`}>{t('projects.overview.copyTo')}</Link>
          ) : null}
        </div>

        <div className={styles.block}>
          <h2>{t('projects.overview.question')}</h2>
          {hasQuestion(project) ? (
            <BidiText as="p">{project.question ?? ''}</BidiText>
          ) : (
            <p>
              <NeutralState kind="unknown">{t('projects.overview.notWritten')}</NeutralState>
            </p>
          )}
          <h2>{t('projects.overview.scope')}</h2>
          {project.scope ? (
            <BidiText as="p">{project.scope}</BidiText>
          ) : (
            <p>
              <NeutralState kind="unknown">{t('projects.overview.notWritten')}</NeutralState>
            </p>
          )}
          <div className={styles.facts}>
            <span>{t('projects.overview.content', { languages })}</span>
            <span>
              {t('projects.overview.owner', { name: project.owner?.display_name ?? t('common.unknown') })}
            </span>
            {project.created_at ? (
              <span>{t('projects.overview.created', { date: date(project.created_at) })}</span>
            ) : null}
          </div>
        </div>

        <StageControl projectId={id} current={project.stage} canChange={can('manageSettings')} />

        {isEmpty ? (
          <div className={styles.empty} style={{ marginBlockEnd: '2rem' }}>
            <h2>{t('projects.overview.emptyTitle')}</h2>
            <p>{t('projects.overview.emptyBody')}</p>
            <div className={styles.firstSteps}>
              <div>
                <strong>01 {t('projects.overview.collect')}</strong>
                <Link to={`${base}/resources`}>{t('projects.overview.collectHint')} →</Link>
              </div>
              <div>
                <strong>02 {t('projects.overview.saveSearch')}</strong>
                <Link to={`${base}/searches`}>{t('projects.overview.saveSearchHint')} →</Link>
              </div>
            </div>
          </div>
        ) : null}

        <EvidenceBlock summary={s} failed={summary.isError} loading={summary.isPending} onRetry={() => void summary.refetch()} />

        <MilestonesBlock projectId={id} query={milestones} canEdit={canEdit} />
      </div>

      <aside>
        <QuestionsBlock projectId={id} query={questions} canEdit={canEdit} />
        <NextActions base={base} summary={s} questions={questions.data} />
        <ContentsBlock base={base} summary={s} />
        {!canEdit ? <p className={styles.note}>{t('projects.overview.viewerNote')}</p> : null}
      </aside>
    </div>
  )
}

// ---- stage -------------------------------------------------------------------

function StageControl({
  projectId,
  current,
  canChange,
}: {
  projectId: number
  current: string
  canChange: boolean
}) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const qc = useQueryClient()
  const [last, setLast] = useState<{ from: string; to: string; at: Date } | null>(null)

  const change = useMutation({
    mutationFn: ({ to }: { from: string; to: string }) => setStage(projectId, to),
    onSuccess: (_d, v) => {
      setLast({ from: v.from, to: v.to, at: new Date() }) // audit-ok: event handler
      void invalidate.projectEdited(qc, projectId)
    },
  })

  const index = PROJECT_STAGES.indexOf(current as ProjectStage)
  const label = (s: string) => t(`stage.${s}`, { defaultValue: s })

  return (
    <div className={styles.block}>
      <h2>{t('projects.overview.stage')}</h2>
      <ol className={styles.stages} aria-label={t('projects.overview.stage')}>
        {PROJECT_STAGES.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              className={[
                styles.stageBtn,
                i < index ? styles.stageDone : '',
                i === index ? styles.stageCurrent : '',
              ].join(' ')}
              aria-current={i === index ? 'step' : undefined}
              disabled={!canChange || change.isPending}
              onClick={() => {
                if (s !== current) change.mutate({ from: current, to: s })
              }}
            >
              <span aria-hidden="true">{i < index ? '✓' : i === index ? '●' : '○'}</span>
              {label(s)}
            </button>
          </li>
        ))}
      </ol>
      <p className={styles.meta}>{t('projects.overview.stageHelp')}</p>
      {change.isError ? (
        <ErrorSummary
          title={t('projects.overview.stageFailed')}
          items={[errorMessage(change.error, t)]}
        />
      ) : null}
      {last ? (
        <p className={styles.note}>
          {t('projects.overview.stageChanged', {
            from: label(last.from),
            to: label(last.to),
            back:
              PROJECT_STAGES.indexOf(last.to as ProjectStage) < PROJECT_STAGES.indexOf(last.from as ProjectStage)
                ? t('projects.overview.movedBack')
                : '',
            when: date(last.at, { time: true }),
          })}{' '}
          <button
            type="button"
            className={styles.stageBtn}
            disabled={change.isPending}
            onClick={() => {
              change.mutate({ from: last.to, to: last.from })
              setLast(null)
            }}
          >
            {t('projects.overview.undo')}
          </button>
        </p>
      ) : null}
    </div>
  )
}

// ---- evidence by state ---------------------------------------------------------

function EvidenceBlock({
  summary,
  failed,
  loading,
  onRetry,
}: {
  summary: ProjectSummary | undefined
  failed: boolean
  loading: boolean
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const counts = summary?.evidence_counts
  const unknown = failed || !counts

  return (
    <div className={styles.block}>
      <h2>{t('projects.overview.evidenceTitle')}</h2>
      <p className={styles.meta}>
        {loading
          ? t('common.loading')
          : unknown
            ? t('projects.overview.totalUnknown')
            : t('projects.overview.total', { n: n(counts.total) })}
      </p>
      {failed ? (
        <div className={styles.note} role="alert">
          {t('projects.overview.countsFailed')}{' '}
          <Button onClick={onRetry}>{t('projects.overview.recalculate')}</Button>
        </div>
      ) : null}
      <div
        className={[styles.bar, unknown ? styles.barUnknown : ''].join(' ')}
        role="img"
        aria-label={
          unknown
            ? t('projects.overview.totalUnknown')
            : EVIDENCE_STATES.map((st) => `${t(`evidenceState.${st}`)} ${counts[st]}`).join(', ')
        }
      >
        {!unknown && counts.total > 0
          ? EVIDENCE_STATES.map((st) =>
              counts[st] > 0 ? (
                <span key={st} className={[styles.seg, SEG[st]].join(' ')} style={{ flexGrow: counts[st] }} />
              ) : null,
            )
          : null}
      </div>
      <ul className={styles.legend}>
        {EVIDENCE_STATES.map((st) => (
          <li key={st} className={unknown ? styles.legendUnknown : ''}>
            <span>{t(`evidenceState.${st}`)}</span>
            <strong>{unknown ? t('projects.overview.unknown') : n(counts[st])}</strong>
            <span className={styles.meta}>
              {unknown
                ? t('projects.overview.couldntCalculate')
                : t('projects.overview.ofItems', { total: n(counts.total) })}
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.meta}>{t('projects.overview.reviewedNote')}</p>
    </div>
  )
}

// ---- milestones ----------------------------------------------------------------

function MilestonesBlock({
  projectId,
  query,
  canEdit,
}: {
  projectId: number
  query: { data?: Milestone[]; isPending: boolean; isError: boolean; refetch: () => unknown }
  canEdit: boolean
}) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [percent, setPercent] = useState('0')

  const add = useMutation({
    mutationFn: () =>
      addMilestone(projectId, {
        title: title.trim(),
        due_date: due || null,
        progress_mode: 'manual',
        manual_percent: Math.min(100, Math.max(0, Number(percent) || 0)),
      }),
    onSuccess: () => {
      setOpen(false)
      setTitle('')
      setDue('')
      setPercent('0')
      void invalidate.milestonesChanged(qc, projectId)
    },
  })

  return (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <h2>{t('projects.overview.milestones')}</h2>
        {canEdit ? (
          <button type="button" className={styles.stageBtn} onClick={() => setOpen((o) => !o)}>
            {t('projects.overview.addMilestone')}
          </button>
        ) : null}
      </div>

      {open ? (
        <form
          className={styles.inlineForm}
          onSubmit={(e) => {
            e.preventDefault()
            if (title.trim()) add.mutate()
          }}
        >
          <Field label={t('projects.overview.milestoneTitle')}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className={styles.row2}>
            <Field label={t('projects.overview.milestoneDue')}>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <Field label={t('projects.overview.milestonePercent')}>
              <input
                type="number"
                min={0}
                max={100}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
            </Field>
          </div>
          {add.isError ? (
            <ErrorSummary title={t('states.error.title')} items={[errorMessage(add.error, t)]} />
          ) : null}
          <div className={styles.row2}>
            <Button type="submit" variant="primary" disabled={add.isPending || !title.trim()}>
              {t('projects.overview.milestoneSave')}
            </Button>
          </div>
        </form>
      ) : null}

      {query.isError ? (
        <div className={styles.banner} role="alert">
          <h2>{t('states.error.title')}</h2>
          <Button onClick={() => void query.refetch()}>{t('common.retry')}</Button>
        </div>
      ) : query.isPending ? (
        <p className={styles.meta}>{t('common.loading')}</p>
      ) : (query.data ?? []).length === 0 ? (
        <p className={styles.meta}>{t('projects.overview.noMilestones')}</p>
      ) : (
        <ul className={styles.list2}>
          {(query.data ?? []).map((m) => {
            const manual = (m.progress_mode ?? 'manual') === 'manual'
            const pct = manual ? (m.manual_percent ?? 0) : null
            return (
              <li key={m.id} className={styles.item}>
                <div className={styles.itemTop}>
                  <strong>{m.title}</strong>
                  {m.due_date ? <span className={styles.meta}>{t('projects.overview.due', { date: date(m.due_date) })}</span> : null}
                </div>
                <div className={styles.meta}>
                  {manual ? (
                    <>
                      {t('projects.overview.manualBasis', { percent: pct })}{' '}
                      <NeutralState kind="limitation">{t('projects.overview.manualTag')}</NeutralState>
                    </>
                  ) : (
                    (m.computed_basis ?? t('projects.overview.computedUnknown'))
                  )}
                </div>
                {pct !== null ? (
                  <span className={styles.progress} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <span className={styles.progressFill} style={{ inlineSize: `${pct}%` }} />
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ---- open questions --------------------------------------------------------------

function QuestionsBlock({
  projectId,
  query,
  canEdit,
}: {
  projectId: number
  query: { data?: ProjectQuestion[]; isPending: boolean; isError: boolean; refetch: () => unknown }
  canEdit: boolean
}) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const add = useMutation({
    mutationFn: () => addQuestion(projectId, text.trim()),
    onSuccess: () => {
      setOpen(false)
      setText('')
      void invalidate.questionsChanged(qc, projectId)
    },
  })
  const unresolved = (query.data ?? []).filter((q) => !q.resolved)

  return (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <h2>{t('projects.overview.questions')}</h2>
        {canEdit ? (
          <button type="button" className={styles.stageBtn} onClick={() => setOpen((o) => !o)}>
            {t('projects.overview.addQuestion')}
          </button>
        ) : null}
      </div>
      {open ? (
        <form
          className={styles.inlineForm}
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) add.mutate()
          }}
        >
          <Field label={t('projects.overview.questionLabel')}>
            <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          {add.isError ? (
            <ErrorSummary title={t('states.error.title')} items={[errorMessage(add.error, t)]} />
          ) : null}
          <div className={styles.row2}>
            <Button type="submit" variant="primary" disabled={add.isPending || !text.trim()}>
              {t('projects.overview.questionSave')}
            </Button>
          </div>
        </form>
      ) : null}
      {query.isError ? (
        <Button onClick={() => void query.refetch()}>{t('common.retry')}</Button>
      ) : unresolved.length === 0 && !query.isPending ? (
        <p className={styles.meta}>{t('projects.overview.noQuestions')}</p>
      ) : (
        <ul className={styles.list2}>
          {unresolved.map((q) => {
            const linked = q.linked_evidence_ids?.length ?? 0
            return (
              <li key={q.id} className={styles.item}>
                <BidiText as="div">{q.text}</BidiText>
                <div className={styles.meta}>
                  {q.created_at ? t('projects.overview.questionMeta', { date: date(q.created_at) }) : ''}
                  {linked > 0 ? t('projects.overview.questionLinked', { count: linked }) : ''}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ---- next actions and contents -----------------------------------------------------

function NextActions({
  base,
  summary,
  questions,
}: {
  base: string
  summary: ProjectSummary | undefined
  questions: ProjectQuestion[] | undefined
}) {
  const { t } = useTranslation()
  const items: { label: string; to: string }[] = []
  const c = summary?.evidence_counts
  if (c && c.candidate > 0) {
    items.push({
      label: t('projects.overview.actionReview', { count: c.candidate }),
      to: `${base}/evidence?state=candidate`,
    })
  }
  if (c && c.unresolved > 0) {
    items.push({
      label: t('projects.overview.actionUnresolved', { count: c.unresolved }),
      to: `${base}/evidence?state=unresolved`,
    })
  }
  if ((questions ?? []).some((q) => !q.resolved)) {
    items.push({ label: t('projects.overview.actionQuestion'), to: base + '/overview' })
  }

  return (
    <div className={styles.block}>
      <h2>{t('projects.overview.nextActions')}</h2>
      {items.length === 0 ? (
        <p className={styles.meta}>{t('projects.overview.noNextActions')}</p>
      ) : (
        <ul className={styles.list2}>
          {items.map((i) => (
            <li key={i.label} className={styles.item}>
              <Link to={i.to}>{i.label} →</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ContentsBlock({ base, summary }: { base: string; summary: ProjectSummary | undefined }) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const rows: [string, ReactNode, string][] = [
    [`${base}/resources`, summary?.resources_count, 'resources'],
    [`${base}/searches`, summary?.saved_searches_count, 'searches'],
    [`${base}/searches`, summary?.result_sets_count, 'resultSets'],
    [`${base}/analysis`, summary?.analyses_count, 'analyses'],
    [`${base}/findings`, summary?.findings_count, 'findings'],
    [`${base}/findings`, summary?.documents_count, 'documents'],
  ]
  return (
    <ul className={styles.contents}>
      {rows.map(([to, value, key]) => (
        <li key={key}>
          <Link to={to}>
            <strong>{typeof value === 'number' ? n(value) : t('projects.overview.unknown')}</strong>{' '}
            {t(`projects.overview.contents.${key}`)}
          </Link>
        </li>
      ))}
    </ul>
  )
}
