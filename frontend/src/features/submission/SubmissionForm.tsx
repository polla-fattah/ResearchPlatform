import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import type { DocumentItem } from '@/api/schemas/writing'
import type { Submission } from '@/api/schemas/submission'
import { createSubmission, validatePrePublication } from '@/api/submissions'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Field } from '@/components/Field'
import { MutationNotice } from '@/components/MutationNotice'
import { usePreferences } from '@/app/preferencesContext'
import { parseKeywords } from '@/features/announcement/announcementModel'
import { canFreeze, LICENCES, nextStep } from './submissionModel'
import { CheckPanel } from './CheckPanel'
import styles from './Submission.module.css'

interface Props {
  projectId: number
  projectTitle: string
  documents: readonly DocumentItem[]
  findingsCount: number | null
  /** The newest package, or null. A response to a revision request is a new package whose parent it is. */
  latest: Submission | null
}

/**
 * Build a package: choose the documents, write the public details, state the rights, read the check, freeze. The check
 * is the server's, asked again each time the chosen documents change. Nothing is sent until every part is in place and
 * the person has confirmed what is frozen. Mounted by the page only when a package may be made.
 */
export function SubmissionForm({ projectId, projectTitle, documents, findingsCount, latest }: Props) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const qc = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const responding = nextStep(latest) === 'respond'

  const schema = z.object({
    documentIds: z.array(z.string()).min(1, t('submission.form.chooseOne')),
    title: z.string().trim().min(1, t('submission.form.titleRequired')).max(500),
    abstract: z.string().trim().min(1, t('submission.form.abstractRequired')),
    keywords: z.string(),
    licence: z.enum(LICENCES),
    rightsConfirmed: z.boolean().refine((v) => v, t('submission.form.confirmRequired')),
    coiConfirmed: z.boolean().refine((v) => v, t('submission.form.confirmRequired')),
    response: z.string(),
  })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { documentIds: [], title: latest?.title ?? projectTitle, abstract: latest?.abstract ?? '', keywords: (latest?.keywords ?? []).join(', '), licence: 'CC-BY-4.0', rightsConfirmed: false, coiConfirmed: false, response: '' },
  })
  const typed = useWatch({ control })
  const ids = (typed.documentIds ?? []).map(Number).filter((x) => Number.isInteger(x) && x > 0).sort((a, b) => a - b)

  const check = useQuery({
    queryKey: qk.project(projectId).submission.check(ids),
    queryFn: ({ signal }) => validatePrePublication(projectId, ids, signal),
    enabled: ids.length > 0,
    retry: false,
  })
  const issues = check.data?.issues ?? null
  const ready = canFreeze(
    {
      documentIds: ids,
      title: typed.title ?? '',
      abstract: typed.abstract ?? '',
      rightsConfirmed: typed.rightsConfirmed === true,
      coiConfirmed: typed.coiConfirmed === true,
      response: responding ? (typed.response ?? '') : null,
    },
    issues,
  )

  const submit = useMutation({
    mutationFn: (v: Values) =>
      createSubmission(projectId, {
        title: v.title.trim(),
        abstract: v.abstract.trim(),
        document_ids: v.documentIds.map(Number),
        keywords: parseKeywords(v.keywords),
        rights_declaration: v.licence,
        ...(responding && latest ? { parent_submission_id: latest.id, author_response_notes: v.response.trim() } : {}),
      }),
    onSuccess: async () => {
      await invalidate.submissionsChanged(qc, projectId)
      setConfirming(false)
    },
  })

  const chosen = documents.filter((d) => ids.includes(d.id))

  return (
    <form className={styles.step} noValidate onSubmit={handleSubmit(() => setConfirming(true))} aria-label={t('submission.form.label')}>
      {responding && latest ? (
        <section aria-label={t('submission.respond.title')}>
          <h2>{t('submission.respond.title')}</h2>
          {latest.decision?.decision_notes ? <p className={styles.letter}>{latest.decision.decision_notes}</p> : null}
          <Field label={t('submission.respond.response')} requirement="required" hint={t('submission.respond.hint')}>
            <textarea rows={5} dir="auto" {...register('response')} />
          </Field>
        </section>
      ) : null}

      <section aria-label={t('submission.form.what')}>
        <h2>{t('submission.form.what')}</h2>
        <fieldset className={styles.docs}>
          <legend>{t('submission.form.documents')}</legend>
          {documents.length === 0 ? <p className={styles.hint}>{t('submission.form.noDocuments')}</p> : null}
          {documents.map((d) => (
            <label key={d.id} className={styles.doc}>
              <input type="checkbox" value={d.id} disabled={!d.latest_version} {...register('documentIds')} />
              <span>
                {d.title}
                <small>{d.latest_version ? t('submission.form.version', { version: n(d.latest_version.version_number ?? 0) }) : t('submission.form.noVersion')}</small>
              </span>
            </label>
          ))}
        </fieldset>
        {errors.documentIds ? <p role="alert">{errors.documentIds.message}</p> : null}
        <p className={styles.hint}>{findingsCount === null ? t('submission.form.findingsUnknown') : t('submission.form.findings', { count: findingsCount, formattedCount: n(findingsCount) })}</p>
      </section>

      <section aria-label={t('submission.form.details')}>
        <h2>{t('submission.form.details')}</h2>
        <Field label={t('submission.form.title')} requirement="required" error={errors.title?.message}>
          <input dir="auto" {...register('title')} />
        </Field>
        <Field label={t('submission.form.abstract')} requirement="required" error={errors.abstract?.message} hint={t('submission.form.abstractHint')}>
          <textarea rows={6} dir="auto" aria-invalid={errors.abstract ? true : undefined} {...register('abstract')} />
        </Field>
        <Field label={t('submission.form.keywords')} requirement="optional" hint={t('submission.form.keywordsHint')}>
          <input dir="auto" {...register('keywords')} />
        </Field>
        <p className={styles.hint}>{t('submission.form.noAuthors')}</p>
      </section>

      <section aria-label={t('submission.form.rights')}>
        <h2>{t('submission.form.rights')}</h2>
        <Field label={t('submission.form.licence')}>
          <select {...register('licence')}>
            {LICENCES.map((l) => (
              <option key={l} value={l}>
                {t(`submission.licences.${l}`)}
              </option>
            ))}
          </select>
        </Field>
        <label className={styles.check}>
          <input type="checkbox" {...register('rightsConfirmed')} /> {t('submission.form.rightsConfirm')}
        </label>
        {errors.rightsConfirmed ? <p role="alert">{errors.rightsConfirmed.message}</p> : null}
        <label className={styles.check}>
          <input type="checkbox" {...register('coiConfirmed')} /> {t('submission.form.coiConfirm')}
        </label>
        {errors.coiConfirmed ? <p role="alert">{errors.coiConfirmed.message}</p> : null}
        <p className={styles.hint}>{t('submission.form.rightsNote')}</p>
      </section>

      <section aria-label={t('submission.check.title')}>
        <h2>{t('submission.check.title')}</h2>
        <CheckPanel projectId={projectId} issues={issues} loading={ids.length > 0 && check.isPending} failed={check.isError} chosen={ids.length > 0} onRetry={() => void check.refetch()} />
      </section>

      <MutationNotice error={submit.error} title={t('submission.freeze.failed')} />
      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={!ready || submit.isPending}>
          {responding ? t('submission.freeze.respond') : t('submission.freeze.open')}
        </Button>
        {!ready ? <span className={styles.hint}>{t('submission.freeze.notReady')}</span> : null}
      </div>

      {confirming ? (
        <ConfirmAction
          open
          busy={submit.isPending}
          title={t('submission.freeze.title')}
          confirmLabel={t('submission.freeze.confirm')}
          onConfirm={() => void handleSubmit((v) => submit.mutate(v))()}
          onCancel={() => setConfirming(false)}
        >
          <p>
            {t('submission.freeze.what', { documents: n(chosen.length), findings: findingsCount === null ? '?' : n(findingsCount) })}
          </p>
          <ul>
            {chosen.map((d) => (
              <li key={d.id}>{d.title}</li>
            ))}
          </ul>
          <p>{t('submission.freeze.keepWorking')}</p>
          <p>{t('submission.freeze.notPublic')}</p>
        </ConfirmAction>
      ) : null}
    </form>
  )
}
