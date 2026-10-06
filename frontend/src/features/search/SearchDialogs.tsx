import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CorpusOccurrence, CorpusSearchHit } from '@/api/schemas/corpus'
import { createPersonalSearch } from '@/api/savedSearches'
import { createResultSet, createSavedQuery } from '@/api/searchWorkspace'
import { usePreferences } from '@/app/preferencesContext'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { formatCode } from '@/domain/codes'
import { RESOURCE_TYPES } from '@/api/schemas/library'
import { type Definition } from './searchModel'
import styles from './Search.module.css'
import { invalidate } from '@/api/invalidate'
import { MutationNotice } from '@/components/MutationNotice'

export type SaveScope = 'project' | 'me'

/** Save the current text, mode and filters: as a project search (shared with its members) or for the account only. */
export function SaveSearchDialog({
  projectId,
  definition,
  canAddToProject,
  onClose,
  onSaved,
}: {
  projectId: number
  definition: Definition
  /** Whether the person's role in this project lets them add to it. A viewer can still save for themselves. */
  canAddToProject: boolean
  onClose: () => void
  onSaved: (scope: SaveScope, id: number) => void
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [scope, setScope] = useState<SaveScope>(canAddToProject ? 'project' : 'me')
  const save = useMutation({
    mutationFn: () => {
      const def = { name: name.trim(), query_text: definition.q.trim(), search_mode: definition.mode, filter_criteria: definition.filters }
      return scope === 'project' ? createSavedQuery(projectId, def) : createPersonalSearch(def)
    },
    onSuccess: (saved) => {
      void (scope === 'project' ? invalidate.searchChanged(qc, projectId) : invalidate.savedSearchesChanged(qc))
      onSaved(scope, saved.id)
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) save.mutate()
  }

  return (
    <Modal title={t('search.save.title')} onClose={onClose}>
      <form onSubmit={submit} className={styles.dialogForm}>
        <p>
          {t('search.save.summary', { text: definition.q.trim(), mode: t(`search.form.modes.${definition.mode}`) })}
        </p>
        <Field label={t('search.save.name')} requirement="required">
          <input
            autoFocus
            value={name}
            placeholder={t('search.save.namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div role="radiogroup" aria-label={t('search.save.scope.label')}>
          <label className={styles.modeOption}>
            <input type="radio" name="save-scope" checked={scope === 'project'} disabled={!canAddToProject} onChange={() => setScope('project')} />
            {t('search.save.scope.project')}
          </label>
          <label className={styles.modeOption}>
            <input type="radio" name="save-scope" checked={scope === 'me'} onChange={() => setScope('me')} />
            {t('search.save.scope.me')}
          </label>
        </div>
        {!canAddToProject ? <p className={styles.hint}>{t('search.save.scope.projectUnavailable')}</p> : null}
        <p className={styles.hint}>{t('search.saved.scope')}</p>
        <MutationNotice error={save.error} title={t('search.save.failed')} />
        <div className={styles.dialogActions}>
          <Button onClick={onClose} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={save.isPending || !name.trim()}>
            {t('search.save.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export type ResultSetSource =
  | { kind: 'selection'; picks: { hit: CorpusSearchHit; occ: CorpusOccurrence }[] }
  | { kind: 'run'; runId: number; code: string; status: string; count: number }

/** Freeze a result set from the selected occurrences, or from a whole recorded run. */
export function ResultSetDialog({
  projectId,
  source,
  onClose,
  onSaved,
}: {
  projectId: number
  source: ResultSetSource
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const qc = useQueryClient()
  const [name, setName] = useState('')

  const save = useMutation({
    mutationFn: () =>
      source.kind === 'run'
        ? createResultSet(projectId, { name: name.trim(), search_run_id: source.runId, select: 'all' })
        : createResultSet(projectId, {
            name: name.trim(),
            items: source.picks.map(({ hit, occ }) => ({
              resource_type: RESOURCE_TYPES.occurrence.resource_type,
              corpus_id: occ.id,
              snapshot_data: { matn: hit.matn, hadith_id: hit.id, occurrence_id: occ.id },
            })),
          }),
    onSuccess: (set) => {
      void invalidate.searchChanged(qc, projectId)
      onSaved(t('search.set.saved', { code: formatCode('RS', set.id), count: n(set.total_count ?? 0) }))
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) save.mutate()
  }

  const from =
    source.kind === 'selection'
      ? t('search.set.fromSelection', { count: n(source.picks.length) })
      : t('search.set.fromRun', { code: source.code, status: t(`search.run.status.${source.status}`, { defaultValue: source.status }) })

  return (
    <Modal title={t('search.set.title')} onClose={onClose}>
      <form onSubmit={submit} className={styles.dialogForm}>
        <p>{t('search.set.from', { source: from })}</p>
        <Field label={t('search.set.name')} requirement="required">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <p className={styles.hint}>{t('search.set.limit')}</p>
        <p className={styles.hint}>{t('search.set.fixed')}</p>
        <MutationNotice error={save.error} title={t('search.set.failed')} />
        <div className={styles.dialogActions}>
          <Button onClick={onClose} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={save.isPending || !name.trim()}>
            {t('search.set.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
