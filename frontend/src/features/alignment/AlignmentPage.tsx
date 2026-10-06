import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { collate, collationOf } from '@/api/alignment'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import type { Collation } from '@/api/schemas/alignment'
import { usePreferences } from '@/app/preferencesContext'
import { Button } from '@/components/Button'
import { BidiText } from '@/components/BidiText'
import { MutationNotice } from '@/components/MutationNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { analysisCode, idsParam, MAX_REPORTS, parseIds } from '@/features/comparison/comparisonModel'
import { SelectReportsDialog } from '@/features/comparison/SelectReportsDialog'
import { useReports, useRun, useRuns } from '@/features/comparison/useComparison'
import { useProject } from '@/features/projects/useProject'
import { useQueryParams } from '@/hooks/useQueryParams'
import { AlignmentTable } from './AlignmentTable'
import { alignmentInputs, MIN_TEXTS, textLabel } from './alignmentModel'
import styles from './Alignment.module.css'

/**
 * Screen 26. The texts being aligned, the baseline and "only the differences" are in the address
 * (?h=<report ids>&base=<report>&diff=0) and `?run=<id>` opens a stored alignment from what the server stored. The alignment is
 * computed by the server and never by this screen; computing stores nothing, so it is a query keyed by its inputs.
 */
export function AlignmentPage() {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const qc = useQueryClient()
  const { id: projectId, can } = useProject()
  const url = useQueryParams()
  const [selecting, setSelecting] = useState(false)
  const pid = projectId ?? 0
  const canEdit = can('addShared')

  const ids = parseIds(url.text('h'), MAX_REPORTS)
  const base = url.id('base')
  const onlyDifferences = url.text('diff') !== '0'
  const runId = url.id('run')

  const loaded = useReports(runId ? [] : ids)
  const { input, baseline, withoutText } = alignmentInputs(loaded.reports, base, textLabel)
  const labelOf = new Map(loaded.reports.map((r) => [String(r.id), textLabel(r)]))

  const computed = useQuery({
    queryKey: qk.project(pid).compare.collate(input),
    queryFn: ({ signal }) => collate(pid, input!, false, signal).then((r) => r.collation),
    enabled: input !== null && !runId && projectId !== null,
    retry: false,
    staleTime: Infinity,
  })
  const stored = useRun(pid, runId)
  const runs = useRuns(pid)
  const savedRuns = (runs.data ?? []).filter((r) => r.analysis_type === 'sequence_collation')

  const save = useMutation({
    mutationFn: () => collate(pid, input!, true),
    onSuccess: () => invalidate.analysesChanged(qc, pid),
  })

  if (projectId === null) return null

  const storedCollation = stored.data ? collationOf(stored.data) : null
  const collation: Collation | null = runId ? storedCollation : (computed.data ?? null)
  const waiting = !runId && ids.length >= MIN_TEXTS && (loaded.pending || (input !== null && computed.isPending))
  const view = runId ? viewStateOf(stored) : waiting ? 'loading' : computed.isError ? 'error' : 'normal'

  const go = (changes: Record<string, string | number | null>) => url.set(changes, { push: true, keepPage: true })

  return (
    <section aria-label={t('alignment.title')}>
      <div className={styles.bar}>
        <h1>{runId && stored.data ? t('alignment.storedTitle', { code: analysisCode(stored.data.id), version: stored.data.version_number }) : t('alignment.title')}</h1>
        <p className={styles.sub}>{t('alignment.sub')}</p>
      </div>
      <p className={styles.note} role="note">
        {t('alignment.automatic')}
      </p>

      {!runId ? (
        <div className={styles.controls}>
          <Button variant="primary" onClick={() => setSelecting(true)}>
            {ids.length === 0 ? t('alignment.pick') : t('alignment.change')}
          </Button>
          {baseline && loaded.reports.length >= MIN_TEXTS ? (
            <label>
              {t('alignment.baseline')}
              <select value={baseline.id} onChange={(e) => go({ base: e.target.value })}>
                {loaded.reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {textLabel(r)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className={styles.check}>
            <input type="checkbox" checked={onlyDifferences} onChange={(e) => url.set({ diff: e.target.checked ? null : '0' }, { keepPage: true })} /> {t('alignment.onlyDifferences')}
          </label>
        </div>
      ) : (
        <p>
          <Link to={`/projects/${projectId}/analysis/matn`}>{t('alignment.backToNew')}</Link>
        </p>
      )}

      <StateBoundary state={view} errorValue={runId ? stored.error : computed.error} onRetry={() => void (runId ? stored.refetch() : computed.refetch())}>
        {!runId && ids.length < MIN_TEXTS ? (
          <div className={styles.empty}>
            <h2>{t('alignment.empty.title')}</h2>
            <p>{t('alignment.empty.body')}</p>
            <Button variant="primary" onClick={() => setSelecting(true)}>
              {t('alignment.pick')}
            </Button>
          </div>
        ) : null}

        {!runId && loaded.missing.length > 0 ? <p className={styles.note}>{t('alignment.missing', { ids: loaded.missing.join(', ') })}</p> : null}
        {!runId && loaded.failed ? <p className={styles.note} role="alert">{t('alignment.loadFailed')}</p> : null}
        {!runId && withoutText.length > 0 ? <p className={styles.note}>{t('alignment.withoutText', { ids: withoutText.join(', ') })}</p> : null}
        {runId && stored.data && !storedCollation ? <p className={styles.note}>{t('alignment.notAlignment')}</p> : null}

        {collation ? (
          <>
            {!runId && baseline ? (
              <ul className={styles.texts} aria-label={t('alignment.texts')}>
                {loaded.reports.map((r) => (
                  <li key={r.id} className={styles.text}>
                    <strong>{textLabel(r)}</strong> {r.id === baseline.id ? <span className={styles.sub}>· {t('alignment.isBaseline')}</span> : null}
                    <BidiText as="p">{r.matn ?? r.clean_matn ?? r.full_hadith ?? ''}</BidiText>
                  </li>
                ))}
              </ul>
            ) : null}
            {runId && collation.baseline_text ? (
              <p>
                <strong>{t('alignment.baselineText')}</strong> <BidiText>{collation.baseline_text}</BidiText>
              </p>
            ) : null}
            <p className={styles.legend}>{t('alignment.legend')}</p>
            {collation.comparisons.map((v) => (
              <AlignmentTable
                key={String(v.variant_id)}
                baselineLabel={baseline ? textLabel(baseline) : t('alignment.baselineShort')}
                variant={v}
                label={labelOf.get(String(v.variant_id)) ?? v.label ?? String(v.variant_id)}
                onlyDifferences={onlyDifferences}
              />
            ))}
            {!runId && canEdit && input ? (
              <div className={styles.actions}>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {t('alignment.save')}
                </Button>
                {save.data?.saved ? <span role="status">{t('alignment.savedAs', { code: analysisCode(save.data.saved.id), version: save.data.saved.version_number })}</span> : null}
              </div>
            ) : null}
            <MutationNotice error={save.error} title={t('alignment.saveFailed')} />
            {!runId && !canEdit ? <p className={styles.sub}>{t('alignment.readOnly')}</p> : null}
          </>
        ) : null}
      </StateBoundary>

      <h2>{t('alignment.saved.title')}</h2>
      {savedRuns.length === 0 ? (
        <p className={styles.sub}>{t('alignment.saved.none')}</p>
      ) : (
        <ul className={styles.runs}>
          {savedRuns.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => go({ run: r.id, h: null, base: null })}>
                {analysisCode(r.id)} · {t('alignment.saved.version', { version: r.version_number })}
              </button>
              {r.created_at ? <span className={styles.sub}> · {date(r.created_at)}</span> : null}
            </li>
          ))}
        </ul>
      )}

      {selecting ? (
        <SelectReportsDialog
          projectId={projectId}
          initial={ids}
          onClose={() => setSelecting(false)}
          onApply={(picked) => {
            setSelecting(false)
            go({ h: idsParam(picked), base: null, run: null })
          }}
        />
      ) : null}
    </section>
  )
}
