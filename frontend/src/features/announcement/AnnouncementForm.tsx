import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { publishAnnouncement, saveAnnouncement, unpublishAnnouncement } from '@/api/announcements'
import { invalidate } from '@/api/invalidate'
import type { Announcement } from '@/api/schemas/announcement'
import type { ProjectDetail } from '@/api/schemas/projectDetail'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Field } from '@/components/Field'
import { MutationNotice } from '@/components/MutationNotice'
import { PROJECT_STAGES } from '@/domain/vocab'
import { isLive, isValidSlug, keywordsText, parseKeywords, publishGaps, slugify, statusToKeep } from './announcementModel'
import { PublicPreview } from './PublicPreview'
import styles from './Announcement.module.css'

interface Props {
  projectId: number
  project: ProjectDetail
  /** The saved announcement, or null while starting a first draft. */
  announcement: Announcement | null
  canEdit: boolean
}

/**
 * The form and the preview that follows it. It is keyed by the saved announcement (id and last change), so a save that
 * the server accepted starts the form again from what the server holds, and nothing is copied by an effect. Typed
 * values live in the form; the saved ones come from the query.
 */
export function AnnouncementForm({ projectId, project, announcement, canEdit }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState<'publish' | 'unpublish' | null>(null)
  const live = isLive(announcement)

  const schema = z.object({
    title: z.string().trim().min(1, t('announcement.form.titleRequired')).max(500),
    summary: z.string().trim().min(1, t('announcement.form.summaryRequired')),
    slug: z.string().trim().refine(isValidSlug, t('announcement.form.slugInvalid')),
    stage: z.string().min(1).max(50),
    keywords: z.string(),
  })
  type Values = z.infer<typeof schema>
  const initialTitle = announcement?.title ?? project.title
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    control,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialTitle,
      summary: announcement?.summary ?? '',
      slug: announcement?.public_slug ?? slugify(initialTitle),
      stage: announcement?.research_stage ?? project.stage,
      keywords: keywordsText(announcement?.keywords),
    },
  })
  const typed = useWatch({ control })

  const save = useMutation({
    mutationFn: (v: Values) =>
      saveAnnouncement(
        projectId,
        { public_slug: v.slug.trim(), title: v.title.trim(), summary: v.summary.trim(), research_stage: v.stage, keywords: parseKeywords(v.keywords) },
        statusToKeep(announcement),
      ),
    onSuccess: () => invalidate.announcementChanged(qc, projectId),
  })
  const publish = useMutation({
    mutationFn: () => publishAnnouncement(projectId),
    onSuccess: async () => {
      await invalidate.announcementChanged(qc, projectId)
      setConfirm(null)
    },
  })
  const unpublish = useMutation({
    mutationFn: () => unpublishAnnouncement(projectId),
    onSuccess: async () => {
      await invalidate.announcementChanged(qc, projectId)
      setConfirm(null)
    },
  })

  const gaps = publishGaps({ title: typed.title ?? '', summary: typed.summary ?? '', slug: typed.slug ?? '' }, isDirty || announcement === null)
  const busy = save.isPending || publish.isPending || unpublish.isPending

  return (
    <div className={styles.layout}>
      <form className={styles.form} noValidate onSubmit={handleSubmit((v) => save.mutate(v))} aria-label={t('announcement.form.label')}>
        <p className={styles.hint}>{t('announcement.form.onlyThese')}</p>
        {live && canEdit ? <p role="status" className={styles.gaps}>{t('announcement.form.liveWarning')}</p> : null}
        <Field label={t('announcement.form.title')} requirement="required" error={errors.title?.message}>
          <input dir="auto" disabled={!canEdit} aria-invalid={errors.title ? true : undefined} {...register('title')} />
        </Field>
        <Field label={t('announcement.form.summary')} requirement="required" error={errors.summary?.message} hint={t('announcement.form.summaryHint')}>
          <textarea rows={7} dir="auto" disabled={!canEdit} aria-invalid={errors.summary ? true : undefined} {...register('summary')} />
        </Field>
        <Field label={t('announcement.form.stage')} hint={t('announcement.form.stageHint')}>
          <select disabled={!canEdit} {...register('stage')}>
            {PROJECT_STAGES.map((s) => (
              <option key={s} value={s}>
                {t(`stage.${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('announcement.form.keywords')} requirement="optional" hint={t('announcement.form.keywordsHint')}>
          <input dir="auto" disabled={!canEdit} {...register('keywords')} />
        </Field>
        <Field label={t('announcement.form.slug')} error={errors.slug?.message} hint={t('announcement.form.slugHint')}>
          <span className={styles.slugRow}>
            <input dir="ltr" disabled={!canEdit || live} aria-invalid={errors.slug ? true : undefined} {...register('slug')} />
            {canEdit && !live ? (
              <Button onClick={() => setValue('slug', slugify(getValues('title')), { shouldDirty: true, shouldValidate: true })}>{t('announcement.form.slugFromTitle')}</Button>
            ) : null}
          </span>
        </Field>
        <p className={styles.hint}>{t('announcement.form.noCredit')}</p>

        <MutationNotice error={save.error} title={t('announcement.form.saveFailed')} />
        <MutationNotice error={publish.error} title={t('announcement.publish.failed')} />
        <MutationNotice error={unpublish.error} title={t('announcement.unpublish.failed')} />

        {canEdit && !live && gaps.length > 0 ? (
          <div className={styles.gaps} role="status">
            <strong>{t('announcement.publish.cannot', { count: gaps.length })}</strong>
            <ul>
              {gaps.map((g) => (
                <li key={g}>{t(`announcement.publish.gaps.${g}`)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {canEdit ? (
          <div className={styles.actions}>
            <Button type="submit" variant={live ? 'primary' : 'secondary'} disabled={busy || !isDirty}>
              {save.isPending ? t('announcement.form.saving') : live ? t('announcement.form.saveLive') : t('announcement.form.saveDraft')}
            </Button>
            {!live ? (
              <Button variant="primary" disabled={busy || gaps.length > 0} onClick={() => setConfirm('publish')}>
                {t('announcement.publish.open')}
              </Button>
            ) : (
              <Button variant="danger" disabled={busy} onClick={() => setConfirm('unpublish')}>
                {t('announcement.unpublish.open')}
              </Button>
            )}
            <span role="status" className={styles.hint}>
              {isDirty ? t('announcement.form.unsaved') : save.isSuccess ? t('announcement.form.saved') : ''}
            </span>
          </div>
        ) : null}
      </form>

      <div className={styles.side}>
        <PublicPreview
          title={typed.title ?? ''}
          summary={typed.summary ?? ''}
          stage={typed.stage ?? project.stage}
          keywords={parseKeywords(typed.keywords ?? '')}
          project={{ title: project.title, scope: project.scope ?? null, owner: project.owner?.display_name ?? null }}
        />
        <p className={styles.never}>{t('announcement.never')}</p>
      </div>

      {confirm === 'publish' ? (
        <ConfirmAction open busy={publish.isPending} title={t('announcement.publish.title', { title: announcement?.title ?? '' })} confirmLabel={t('announcement.publish.confirm')} onConfirm={() => publish.mutate()} onCancel={() => setConfirm(null)}>
          <p>{t('announcement.publish.body')}</p>
          <ul>
            {(['title', 'summary', 'stage', 'keywords', 'project', 'scope', 'owner'] as const).map((k) => (
              <li key={k}>{t(`announcement.publish.items.${k}`)}</li>
            ))}
          </ul>
          <p>{t('announcement.publish.after')}</p>
        </ConfirmAction>
      ) : null}
      {confirm === 'unpublish' ? (
        <ConfirmAction open danger busy={unpublish.isPending} title={t('announcement.unpublish.title', { title: announcement?.title ?? '' })} confirmLabel={t('announcement.unpublish.confirm')} onConfirm={() => unpublish.mutate()} onCancel={() => setConfirm(null)}>
          <p>{t('announcement.unpublish.body')}</p>
        </ConfirmAction>
      ) : null}
    </div>
  )
}
