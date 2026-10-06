import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { userMessage } from '@/api/errors'

import {
  getProjectSummary,
  projectDetailKeys,
  toggleArchive,
  trashProject,
  updateProject,
} from '@/api/projectDetail'
import { projectKeys } from '@/api/projects'
import { usePreferences } from '@/app/preferencesContext'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { ErrorSummary, Field, Notice } from '@/components/Field'
import { isProjectStage } from '@/domain/vocab'
import styles from './Projects.module.css'
import { useProject } from './useProject'

/** Screen 06, Settings view. Only the owner can change anything here. */
export function ProjectSettingsPage() {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { id, project, can } = useProject()
  const owner = can('manageSettings')

  const [title, setTitle] = useState(project?.title ?? '')
  const [question, setQuestion] = useState(project?.question ?? '')
  const [scope, setScope] = useState(project?.scope ?? '')
  const [confirmTrash, setConfirmTrash] = useState(false)

  const summary = useQuery({
    queryKey: projectDetailKeys.summary(id ?? 0),
    queryFn: ({ signal }) => getProjectSummary(id!, signal),
    enabled: id !== null,
    retry: false,
  })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: projectKeys.all })
    void qc.invalidateQueries({ queryKey: projectDetailKeys.detail(id ?? 0) })
  }

  const save = useMutation({
    mutationFn: () => updateProject(id!, { title: title.trim(), question: question.trim(), scope: scope.trim() }),
    onSuccess: refresh,
  })
  const archive = useMutation({ mutationFn: () => toggleArchive(id!), onSuccess: refresh })
  const trash = useMutation({
    mutationFn: () => trashProject(id!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.all })
      navigate('/projects?scope=trash', { replace: true })
    },
  })

  if (!project || id === null) return null
  const stage = isProjectStage(project.stage) ? t(`stage.${project.stage}`) : project.stage
  const counts = summary.data
  const label = (key: 'evidence' | 'finding' | 'item', count: number) =>
    t(`units.${key}`, { count, formattedCount: n(count) })

  return (
    <section>
      {!owner ? <Notice dashed>{t('projects.settings.readOnly')}</Notice> : null}

      <div className={styles.formCard} style={{ marginBlock: '1rem' }}>
        <h2 style={{ margin: 0 }}>{t('projects.settings.details')}</h2>
        {save.isError ? (
          <ErrorSummary
            title={t('projects.settings.saveFailed')}
            items={[userMessage(save.error, t('states.error.body'))]}
          />
        ) : null}
        {save.isSuccess ? <Notice>{t('projects.settings.saved')}</Notice> : null}
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault()
            if (owner && title.trim()) save.mutate()
          }}
        >
          <Field label={t('projects.create.fields.title')}>
            <input value={title} disabled={!owner} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t('projects.create.fields.question')}>
            <textarea rows={3} value={question} disabled={!owner} dir="auto" onChange={(e) => setQuestion(e.target.value)} />
          </Field>
          <Field label={t('projects.create.fields.scope')}>
            <textarea rows={3} value={scope} disabled={!owner} dir="auto" onChange={(e) => setScope(e.target.value)} />
          </Field>
          <div className={styles.row2}>
            <Button type="submit" variant="primary" disabled={!owner || save.isPending || !title.trim()}>
              {t('projects.settings.saveDetails')}
            </Button>
          </div>
        </form>
      </div>

      <div className={styles.card}>
        <div>
          <h2>
            {project.is_archived ? t('projects.settings.unarchiveTitle') : t('projects.settings.archiveTitle')}
          </h2>
          <p>
            {project.is_archived
              ? t('projects.settings.unarchiveBody', { stage })
              : t('projects.settings.archiveBody', { stage })}
          </p>
          {archive.isError ? (
            <p role="alert" style={{ color: 'var(--warn)' }}>
              {userMessage(archive.error, t('states.error.body'))}
            </p>
          ) : null}
        </div>
        <Button disabled={!owner || archive.isPending} onClick={() => archive.mutate()}>
          {project.is_archived ? t('projects.settings.unarchive') : t('projects.settings.archive')}
        </Button>
      </div>

      <div className={[styles.card, styles.cardDisabled].join(' ')}>
        <div>
          <h2>{t('projects.settings.transferTitle')}</h2>
          <p>{t('projects.settings.transferBody')}</p>
        </div>
        <Button disabled>{t('projects.settings.transfer')}</Button>
      </div>

      <div className={[styles.card, styles.cardDanger].join(' ')}>
        <div>
          <h2>{t('projects.settings.trashTitle')}</h2>
          <p>
            {counts
              ? t('projects.settings.trashBody', {
                  evidence: label('evidence', counts.evidence_counts.total),
                  findings: label('finding', counts.findings_count),
                  documents: t('units.document', { count: counts.documents_count, formattedCount: n(counts.documents_count) }),
                })
              : t('projects.index.trashDialog.readOnly')}
          </p>
        </div>
        <Button variant="danger" disabled={!owner || trash.isPending} onClick={() => setConfirmTrash(true)}>
          {t('projects.settings.trash')}
        </Button>
      </div>

      <ConfirmAction
        open={confirmTrash}
        danger
        title={t('projects.index.trashDialog.title', { title: project.title })}
        confirmLabel={t('projects.index.trashDialog.confirm')}
        busy={trash.isPending}
        onCancel={() => setConfirmTrash(false)}
        onConfirm={() => trash.mutate()}
      >
        <p>{t('projects.index.trashDialog.readOnly')}</p>
        <p>{t('projects.index.recovery')}</p>
        {trash.isError ? (
          <p role="alert" style={{ color: 'var(--warn)' }}>
            {userMessage(trash.error, t('states.error.body'))}
          </p>
        ) : null}
      </ConfirmAction>
    </section>
  )
}
