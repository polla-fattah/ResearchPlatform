import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { ApiError, userMessage } from '@/api/errors'
import { createProject } from '@/api/projectDetail'
import { listProjects, projectKeys } from '@/api/projects'
import type { ProjectDetail } from '@/api/schemas/projectDetail'
import { usePreferences } from '@/app/preferencesContext'
import { VisibilityBadge } from '@/components/Badges'
import { detectDirection } from '@/components/direction'
import { Button, ButtonLink } from '@/components/Button'
import { ErrorSummary, Field } from '@/components/Field'
import { formatCode } from '@/domain/codes'
import { PROJECT_STAGES } from '@/domain/vocab'
import styles from './Projects.module.css'

const LANGS = ['ar', 'ckb', 'en'] as const
type Dir = 'auto' | 'rtl' | 'ltr'

const FIELD_ORDER = ['title', 'question', 'scope', 'languages'] as const

export function ProjectCreatePage() {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const qc = useQueryClient()
  const [created, setCreated] = useState<ProjectDetail | null>(null)
  const [createdAt, setCreatedAt] = useState<Date | null>(null)
  const [dir, setDir] = useState<Dir>('auto')

  // Titles must be unique among your projects. The API doesn't check (request file C-12), so we do.
  const owned = useQuery({
    queryKey: projectKeys.list({ scope: 'owned', per_page: 100 }),
    queryFn: ({ signal }) => listProjects({ scope: 'owned', per_page: 100 }, signal),
  })
  const existing = owned.data?.items ?? []

  const schema = z
    .object({
      title: z.string().trim().min(1, t('projects.create.errors.title')),
      question: z.string().trim().min(1, t('projects.create.errors.question')),
      scope: z.string().trim().min(1, t('projects.create.errors.scope')),
      languages: z.array(z.enum(LANGS)).min(1, t('projects.create.errors.languages')),
      stage: z.enum(PROJECT_STAGES),
      tags: z.string().optional(),
    })
    .superRefine((v, ctx) => {
      const match = existing.find((p) => p.title.trim().toLowerCase() === v.title.trim().toLowerCase())
      if (match) {
        ctx.addIssue({
          code: 'custom',
          path: ['title'],
          message: t('projects.create.errors.duplicate', { code: formatCode('PRJ', match.id) }),
        })
      }
    })
  type Values = z.infer<typeof schema>

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitted },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { stage: 'scoping', languages: [], tags: '' },
  })

  // Hooks must run before any early return below (created view, forbidden view).
  const questionText = useWatch({ control, name: 'question' }) ?? ''

  const create = useMutation({
    mutationFn: createProject,
    onSuccess: (project) => {
      void qc.invalidateQueries({ queryKey: projectKeys.all })
      setCreatedAt(new Date())
      setCreated(project)
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        for (const [key, messages] of Object.entries(err.fields)) {
          if ((FIELD_ORDER as readonly string[]).includes(key) && messages[0]) {
            setError(key as (typeof FIELD_ORDER)[number], { message: messages[0] })
          }
        }
      }
    },
  })

  if (created) {
    return (
      <section className={styles.created}>
        <p className={styles.crumbs}>
          <Link to="/projects">{t('projects.breadcrumb.projects')}</Link> / {t('projects.breadcrumb.newProject')}
        </p>
        <p className="mono">
          ✓{' '}
          {t('projects.create.created.badge', {
            code: formatCode('PRJ', created.id),
            when: createdAt ? date(createdAt, { time: true }) : '',
          })}
        </p>
        <h1 style={{ margin: 0 }}>{created.title}</h1>
        <p>
          <span className={styles.stage}>{t(`stage.${created.stage}`, { defaultValue: created.stage })}</span>{' '}
          <VisibilityBadge visibility="private" />
        </p>
        <p>{t('projects.create.created.intro')}</p>
        <ul className={styles.createdSteps}>
          <li>
            <Link to={`/projects/${created.id}/resources`}>{t('projects.create.created.addResources')} →</Link>{' '}
            <span className={styles.meta}>{t('projects.create.created.addResourcesHint')}</span>
          </li>
          <li>
            <Link to={`/projects/${created.id}/searches`}>{t('projects.create.created.search')} →</Link>{' '}
            <span className={styles.meta}>{t('projects.create.created.searchHint')}</span>
          </li>
          <li>
            <Link to={`/projects/${created.id}/overview`}>{t('projects.create.created.overview')} →</Link>{' '}
            <span className={styles.meta}>{t('projects.create.created.overviewHint')}</span>
          </li>
        </ul>
        <div className={styles.sideBySide} style={{ margin: 0 }}>
          <div className={styles.preview}>
            <strong>{t('projects.create.created.privateTitle')}</strong>
            <p>{t('projects.create.created.privateBody')}</p>
          </div>
          <div className={styles.preview}>
            <strong>{t('projects.create.created.separateTitle')}</strong>
            <p>{t('projects.create.created.separateBody')}</p>
          </div>
        </div>
      </section>
    )
  }

  // The backend refuses non-approved accounts with a specific code (ACC-02/03).
  if (create.error instanceof ApiError && create.error.code === 'ACCOUNT_NOT_APPROVED') {
    return (
      <section className={styles.empty}>
        <h1>{t('projects.create.forbiddenTitle')}</h1>
        <p>{t('projects.create.forbiddenBody')}</p>
        <div className={styles.actions}>
          <ButtonLink to="/status">{t('projects.create.seeStatus')}</ButtonLink>
          <ButtonLink to="/projects">{t('projects.create.backToProjects')}</ButtonLink>
        </div>
      </section>
    )
  }

  const problems = FIELD_ORDER.flatMap((f) => {
    const message = errors[f]?.message
    return message ? [`${t(`projects.create.fields.${f}`)}: ${message}`] : []
  })
  const serverMessage =
    create.error instanceof ApiError && Object.keys(create.error.fields).length === 0
      ? userMessage(create.error, t('states.error.body'))
      : null

  const resolvedDir: 'ltr' | 'rtl' | undefined = dir === 'auto' ? detectDirection(questionText) : dir

  return (
    <section>
      <p className={styles.crumbs}>
        <Link to="/projects">{t('projects.breadcrumb.projects')}</Link> / {t('projects.breadcrumb.newProject')}
      </p>
      <div className={styles.formCard}>
        <div>
          <h1 style={{ margin: 0 }}>{t('projects.create.title')}</h1>
          <p style={{ margin: '0.5rem 0 0' }}>{t('projects.create.lead')}</p>
        </div>

        {problems.length > 0 && isSubmitted ? (
          <ErrorSummary
            title={t('projects.create.fixFields', { count: problems.length })}
            items={problems}
            footer={t('projects.create.keptNote')}
          />
        ) : null}
        {serverMessage ? (
          <ErrorSummary
            title={t('projects.create.failed')}
            items={[serverMessage]}
            footer={t('projects.create.keptNote')}
          />
        ) : null}

        <form
          className={styles.form}
          noValidate
          onSubmit={handleSubmit((v) =>
            create
              .mutateAsync({
                title: v.title.trim(),
                question: v.question.trim(),
                scope: v.scope.trim(),
                languages: v.languages,
                stage: v.stage,
                tags: (v.tags ?? '')
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
              .catch(() => undefined),
          )}
        >
          <Field
            label={t('projects.create.fields.title')}
            requirement="required"
            error={errors.title?.message}
          >
            <input
              placeholder={t('projects.create.placeholders.title')}
              disabled={create.isPending}
              aria-invalid={errors.title ? true : undefined}
              {...register('title')}
            />
          </Field>

          <Field
            label={t('projects.create.fields.question')}
            requirement="required"
            error={errors.question?.message}
            hint={t('projects.create.hints.direction')}
          >
            <textarea
              rows={3}
              dir={resolvedDir ?? 'auto'}
              placeholder={t('projects.create.placeholders.question')}
              disabled={create.isPending}
              aria-invalid={errors.question ? true : undefined}
              {...register('question')}
            />
          </Field>
          <div className={styles.segmented} role="group" aria-label={t('projects.create.hints.direction')}>
            {(['auto', 'rtl', 'ltr'] as const).map((d) => (
              <button
                key={d}
                type="button"
                className={dir === d ? styles.on : ''}
                aria-pressed={dir === d}
                onClick={() => setDir(d)}
              >
                {t(`projects.create.direction.${d}`)}
              </button>
            ))}
          </div>

          <Field
            label={t('projects.create.fields.scope')}
            requirement="required"
            error={errors.scope?.message}
          >
            <textarea
              rows={3}
              placeholder={t('projects.create.placeholders.scope')}
              disabled={create.isPending}
              aria-invalid={errors.scope ? true : undefined}
              {...register('scope')}
            />
          </Field>

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: '0.875rem', marginBlockEnd: '0.375rem' }}>
              {t('projects.create.fields.languages')}{' '}
              <span className="mono" style={{ color: 'var(--accent)' }}>
                {t('common.required')}
              </span>
            </legend>
            <Controller
              control={control}
              name="languages"
              render={({ field }) => (
                <div className={styles.checks}>
                  {LANGS.map((l) => {
                    const on = field.value.includes(l)
                    return (
                      <label key={l} className={[styles.check, on ? styles.checkOn : ''].join(' ')}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={create.isPending}
                          onChange={() =>
                            field.onChange(on ? field.value.filter((x) => x !== l) : [...field.value, l])
                          }
                        />
                        {t(`projects.create.languages.${l}`)}
                      </label>
                    )
                  })}
                </div>
              )}
            />
            <span className={errors.languages ? '' : styles.meta} style={errors.languages ? { color: 'var(--warn)', fontSize: '0.8125rem' } : undefined}>
              {errors.languages?.message
                ? errors.languages.message.charAt(0).toUpperCase() + errors.languages.message.slice(1)
                : t('projects.create.hints.languages')}
            </span>
          </fieldset>

          <Field label={t('projects.create.fields.stage')} hint={t('projects.create.hints.stage')}>
            <select disabled={create.isPending} {...register('stage')}>
              {PROJECT_STAGES.map((s) => (
                <option key={s} value={s}>
                  {t(`stage.${s}`)}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={t('projects.create.fields.tags')}
            requirement="optional"
            hint={t('projects.create.hints.tags')}
          >
            <input
              placeholder={t('projects.create.placeholders.tags')}
              disabled={create.isPending}
              {...register('tags')}
            />
          </Field>

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: '0.875rem', marginBlockEnd: '0.375rem' }}>
              {t('projects.create.fields.template')}
            </legend>
            <label className={styles.row2}>
              <input type="radio" checked readOnly /> {t('projects.create.template.blank')}
            </label>
            <label className={[styles.row2, styles.disabledChoice].join(' ')}>
              <input type="radio" disabled /> {t('projects.create.template.takhrij')}
            </label>
            <label className={[styles.row2, styles.disabledChoice].join(' ')}>
              <input type="radio" disabled /> {t('projects.create.template.narrator')}
            </label>
          </fieldset>

          <div className={styles.row2}>
            <Button type="submit" variant="primary" disabled={create.isPending}>
              {create.isPending ? t('projects.create.submitting') : t('projects.create.submit')}
            </Button>
            <ButtonLink to="/projects">{t('projects.create.cancel')}</ButtonLink>
          </div>
        </form>
      </div>
    </section>
  )
}
