import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { invalidate } from '@/api/invalidate'
import { listProjects } from '@/api/projects'
import { qk } from '@/api/queryKeys'
import type { ProjectTemplate } from '@/api/schemas/templates'
import { createFromTemplate, listTemplates } from '@/api/templates'
import { BidiText } from '@/components/BidiText'
import { Button, ButtonLink } from '@/components/Button'
import { Field } from '@/components/Field'
import { MutationNotice } from '@/components/MutationNotice'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { useQueryParams } from '@/hooks/useQueryParams'
import { isUsable, stageNames, taskTitles, titleTaken } from './templatesModel'
import styles from './Templates.module.css'

const LANGS = ['ar', 'ckb', 'en'] as const

/**
 * Screen 37. The server's project templates, and a new private project made from one. A template only supplies a
 * starting question and starting tasks; it adds no evidence, gradings or conclusions. The design's research-question
 * list, evidence fields, template versions and editing a template's contents before creating have no server support
 * (request file C-41), so the person changes the question here and everything else in the project afterwards.
 */
export function TemplatesPage() {
  const { t } = useTranslation()
  const url = useQueryParams()
  const selectedId = url.id('template')
  const list = useQuery({ queryKey: qk.templates, queryFn: ({ signal }) => listTemplates(signal) })
  const templates = list.data ?? []
  const chosen = templates.find((x) => x.id === selectedId) ?? null
  const state = list.data ? 'normal' : viewStateOf(list)

  return (
    <section aria-label={t('templates.title')}>
      <p>
        <Link to="/projects">{t('projects.breadcrumb.projects')}</Link> / {t('templates.title')}
      </p>
      <h1>{t('templates.title')}</h1>
      <p>{t('templates.sub')}</p>
      <p className={styles.note} role="note">
        {t('templates.limits')}
      </p>
      <StateBoundary state={state} errorValue={list.error} onRetry={() => void list.refetch()}>
        <RefreshNotice query={list} what={t('templates.title')} />
        {templates.length === 0 ? (
          <div className={styles.empty}>
            <h2>{t('templates.empty.title')}</h2>
            <p>{t('templates.empty.body')}</p>
          </div>
        ) : (
          <ul className={styles.cards} aria-label={t('templates.list')}>
            {templates.map((x) => (
              <li key={x.id} className={styles.card} aria-current={x.id === selectedId}>
                <h3>
                  <BidiText>{x.title}</BidiText>
                </h3>
                {x.description ? (
                  <p>
                    <BidiText>{x.description}</BidiText>
                  </p>
                ) : null}
                <p className={styles.meta}>{t('templates.counts', { count: taskTitles(x).length })}</p>
                {stageNames(x).length > 0 ? <p className={styles.meta}>{t('templates.stages', { stages: stageNames(x).join(', ') })}</p> : null}
                {isUsable(x) ? (
                  <Button variant={x.id === selectedId ? 'primary' : undefined} onClick={() => url.set({ template: x.id }, { push: true })} aria-label={t('templates.choose', { title: x.title })}>
                    {x.id === selectedId ? t('templates.chosen') : t('templates.use')}
                  </Button>
                ) : (
                  <p className={styles.meta}>{t('templates.unusable')}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </StateBoundary>
      <p>
        <ButtonLink to="/projects/new">{t('templates.blank')}</ButtonLink>
      </p>
      {selectedId && !chosen && list.data ? <p role="alert">{t('templates.notFound')}</p> : null}
      {chosen && isUsable(chosen) ? <CreateForm key={chosen.id} template={chosen} /> : null}
    </section>
  )
}

function CreateForm({ template }: { template: ProjectTemplate }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const navigate = useNavigate()
  // Titles must be unique among the person's own projects. The server does not check it (request file C-12).
  const owned = useQuery({ queryKey: qk.projects.list({ scope: 'owned', per_page: 100 }), queryFn: ({ signal }) => listProjects({ scope: 'owned', per_page: 100 }, signal) })
  const existing = owned.data?.items ?? []
  const schema = z
    .object({ title: z.string().trim().min(1, t('templates.form.titleRequired')).max(255), question: z.string().trim().min(1, t('templates.form.questionRequired')), language: z.enum(LANGS) })
    .superRefine((v, ctx) => {
      const taken = titleTaken(v.title, existing)
      if (taken) ctx.addIssue({ code: 'custom', path: ['title'], message: t('templates.form.duplicate', { code: formatCode('PRJ', taken.id) }) })
    })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: '', question: template.default_question ?? '', language: 'ar' } })
  const create = useMutation({
    mutationFn: (v: Values) => createFromTemplate(template.id, { title: v.title.trim(), question: v.question.trim(), primaryLanguage: v.language }),
    onSuccess: async (project) => {
      await invalidate.projectLifecycle(qc)
      void navigate(`/projects/${project.id}/overview`)
    },
  })
  const tasks = taskTitles(template)

  return (
    <form noValidate onSubmit={handleSubmit((v) => create.mutate(v))} className={styles.detail} aria-label={t('templates.form.label', { title: template.title })}>
      <h2>{t('templates.form.title', { title: template.title })}</h2>
      <Field label={t('templates.form.projectTitle')} requirement="required" error={errors.title?.message} hint={t('templates.form.projectTitleHint')}>
        <input dir="auto" aria-invalid={errors.title ? true : undefined} {...register('title')} />
      </Field>
      <Field label={t('templates.form.question')} requirement="required" error={errors.question?.message} hint={t('templates.form.questionHint')}>
        <textarea rows={3} dir="auto" aria-invalid={errors.question ? true : undefined} {...register('question')} />
      </Field>
      <Field label={t('templates.form.language')} requirement="required" hint={t('templates.form.languageHint')}>
        <select {...register('language')}>
          {LANGS.map((l) => (
            <option key={l} value={l}>
              {t(`templates.languages.${l}`)}
            </option>
          ))}
        </select>
      </Field>
      <h3>{t('templates.form.tasksTitle')}</h3>
      {tasks.length === 0 ? (
        <p className={styles.meta}>{t('templates.form.noTasks')}</p>
      ) : (
        <ul className={styles.tasks} aria-label={t('templates.form.tasksTitle')}>
          {tasks.map((task, i) => (
            <li key={`${i}-${task}`}>
              <BidiText>{task}</BidiText>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.meta}>{t('templates.form.afterwards')}</p>
      <MutationNotice error={create.error} title={t('templates.form.failed')} />
      <Button type="submit" variant="primary" disabled={create.isPending}>
        {t('templates.form.create')}
      </Button>
    </form>
  )
}
