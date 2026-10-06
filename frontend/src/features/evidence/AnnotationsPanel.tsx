import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { addAnnotation, deleteAnnotation, setAnnotationVisibility } from '@/api/evidence'
import type { Annotation } from '@/api/schemas/evidence'
import { useAuth } from '@/app/authContext'
import { usePreferences } from '@/app/preferencesContext'
import { ProvenanceTag, VisibilityBadge, type ProvenanceKind } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Field } from '@/components/Field'
import styles from './Evidence.module.css'
import { invalidate } from '@/api/invalidate'
import { MutationNotice } from '@/components/MutationNotice'

const KINDS = ['interpretation', 'source_quotation', 'scholarly_judgment'] as const
const PROVENANCE: Record<string, ProvenanceKind> = {
  source_quotation: 'source',
  interpretation: 'note',
  scholarly_judgment: 'attributed',
  machine_suggestion: 'suggestion',
}

interface Props {
  projectId: number
  evidenceId: number
  annotations: Annotation[]
  /** Owner, Researcher and Project reviewer can annotate (SRS §3.2). */
  canAnnotate: boolean
}

export function AnnotationsPanel({ projectId, evidenceId, annotations, canAnnotate }: Props) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [kind, setKind] = useState<(typeof KINDS)[number]>('interpretation')
  const [visibility, setVisibility] = useState<'private' | 'project_shared'>('private')
  const [body, setBody] = useState('')
  const [attributedTo, setAttributedTo] = useState('')
  const [sourceLocator, setSourceLocator] = useState('')
  const [needAttribution, setNeedAttribution] = useState(false)
  const [removing, setRemoving] = useState<Annotation | null>(null)

  const refresh = () => invalidate.annotationsChanged(qc, projectId, evidenceId)

  const add = useMutation({
    mutationFn: () =>
      addAnnotation(projectId, evidenceId, {
        annotation_kind: kind,
        body: body.trim(),
        visibility,
        ...(kind === 'scholarly_judgment' ? { attributed_to: attributedTo.trim(), source_locator: sourceLocator.trim() } : {}),
      }),
    
    onSuccess: async () => {
      setBody('')
      setAttributedTo('')
      setSourceLocator('')
      await refresh()
    },
  })

  const promote = useMutation({
    mutationFn: ({ a, to }: { a: Annotation; to: 'private' | 'project_shared' }) =>
      setAnnotationVisibility(projectId, evidenceId, a.id, to),
    onSuccess: () => refresh(),
  })

  const remove = useMutation({
    mutationFn: (a: Annotation) => deleteAnnotation(projectId, evidenceId, a.id),
    onSuccess: async () => {
      setRemoving(null)
      await refresh()
    },
    onError: () => setRemoving(null),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    if (kind === 'scholarly_judgment' && (!attributedTo.trim() || !sourceLocator.trim())) {
      setNeedAttribution(true)
      return
    }
    setNeedAttribution(false)
    add.mutate()
  }

  return (
    <section className={styles.section} aria-label={t('evidence.annotations.heading')}>
      <h3>
        {t('evidence.annotations.heading')} <span className={styles.count}>{annotations.length}</span>
      </h3>
      <p className={styles.hint}>{t('evidence.annotations.privacy')}</p>

      <MutationNotice error={add.error} title={t('evidence.annotations.failed2')} />
      <MutationNotice error={promote.error} title={t('evidence.annotations.promoteFailed')} />
      <MutationNotice error={remove.error} title={t('evidence.annotations.deleteFailed')} />
      {/* The server may keep the body of a judgment but drop who it is attributed to (request file C-16). */}
      {add.data?.annotation_kind === 'scholarly_judgment' && !add.data.attributed_to ? (
        <p role="status">{t('evidence.annotations.attributionLost')}</p>
      ) : null}

      {annotations.length === 0 ? <p className={styles.hint}>{t('evidence.annotations.none')}</p> : null}
      <ul className={styles.annotations}>
        {annotations.map((a) => {
          const mine = a.author_id === user?.id
          const isPrivate = a.visibility === 'private'
          return (
            <li key={a.id} className={styles.annotation}>
              <div className={styles.annHead}>
                <ProvenanceTag
                  kind={PROVENANCE[a.annotation_kind] ?? 'note'}
                  name={a.annotation_kind === 'scholarly_judgment' ? (a.attributed_to ?? undefined) : undefined}
                />
                <VisibilityBadge visibility={isPrivate ? 'private' : 'project'} />
              </div>
              <p className={styles.annBody}>
                <BidiText>{a.body}</BidiText>
              </p>
              {a.source_locator ? <p className={styles.hint}>{a.source_locator}</p> : null}
              <div className={styles.annMeta}>
                <span className={styles.hint}>
                  {a.author?.display_name ?? ''}
                  {a.created_at ? ` · ${date(a.created_at)}` : ''}
                </span>
                {mine && canAnnotate ? (
                  <span className={styles.annActions}>
                    <Button
                      variant="ghost"
                      disabled={promote.isPending}
                      onClick={() => promote.mutate({ a, to: isPrivate ? 'project_shared' : 'private' })}
                    >
                      {isPrivate ? t('evidence.annotations.promote') : t('evidence.annotations.makePrivate')}
                    </Button>
                    <Button variant="ghost" onClick={() => setRemoving(a)}>
                      {t('evidence.annotations.delete')}
                    </Button>
                  </span>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      {canAnnotate ? (
        <form className={styles.annForm} onSubmit={submit}>
          <label className={styles.inlineField}>
            <span>{t('evidence.annotations.kindLabel')}</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`evidence.annotations.kind.${k}`)}
                </option>
              ))}
            </select>
          </label>
          <Field label={t('evidence.annotations.body')}>
            <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          {kind === 'scholarly_judgment' ? (
            <>
              <Field
                label={t('evidence.annotations.attributedTo')}
                requirement="required"
                error={needAttribution && !attributedTo.trim() ? t('evidence.annotations.attributedRequired') : undefined}
              >
                <input value={attributedTo} onChange={(e) => setAttributedTo(e.target.value)} />
              </Field>
              <Field
                label={t('evidence.annotations.sourceLocator')}
                requirement="required"
                error={needAttribution && !sourceLocator.trim() ? t('evidence.annotations.attributedRequired') : undefined}
              >
                <input value={sourceLocator} onChange={(e) => setSourceLocator(e.target.value)} />
              </Field>
            </>
          ) : null}
          <div role="radiogroup" aria-label={t('evidence.annotations.visibilityLabel')} className={styles.visRow}>
            {(['private', 'project_shared'] as const).map((v) => (
              <label key={v} className={styles.visOption}>
                <input type="radio" name="annotation-visibility" checked={visibility === v} onChange={() => setVisibility(v)} />
                {t(`evidence.annotations.visibility.${v}`)}
              </label>
            ))}
          </div>
          <div>
            <Button type="submit" variant="primary" disabled={add.isPending || !body.trim()}>
              {t('evidence.annotations.save')}
            </Button>
          </div>
        </form>
      ) : (
        <p className={styles.hint}>{t('evidence.annotations.readOnly')}</p>
      )}

      <ConfirmAction
        open={removing !== null}
        danger
        title={t('evidence.annotations.delete')}
        confirmLabel={t('evidence.annotations.delete')}
        busy={remove.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing)}
      >
        <p>{removing?.body}</p>
      </ConfirmAction>
    </section>
  )
}
