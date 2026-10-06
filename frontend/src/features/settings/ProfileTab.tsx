import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { saveProfile } from '@/api/account'
import { invalidate } from '@/api/invalidate'
import { PUBLIC_FIELDS, type PublicField } from '@/api/schemas/account'
import type { Me } from '@/api/schemas/auth'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { MutationNotice } from '@/components/MutationNotice'
import { interestsText, parseInterests, publicFieldsOf } from './settingsModel'
import styles from './Settings.module.css'

const fieldsShape = Object.fromEntries(PUBLIC_FIELDS.map((f) => [f, z.boolean()])) as Record<PublicField, z.ZodBoolean>

const fromMe = (me: Me) => ({
  display_name: me.display_name,
  affiliation: me.profile?.affiliation ?? '',
  biography: me.profile?.biography ?? '',
  interests: interestsText(me.profile?.research_interests),
  is_public: me.profile?.is_public ?? false,
  shown: Object.fromEntries(PUBLIC_FIELDS.map((f) => [f, publicFieldsOf(me.profile?.public_fields).includes(f)])) as Record<PublicField, boolean>,
})

/** Who the researcher is to other people: name, affiliation, interests, biography, and which of them a visitor may see. */
export function ProfileTab({ me }: { me: Me }) {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const schema = z.object({
    display_name: z.string().trim().min(1, t('settings.profile.nameRequired')).max(255),
    affiliation: z.string().max(500),
    biography: z.string(),
    interests: z.string(),
    is_public: z.boolean(),
    shown: z.object(fieldsShape),
  })
  type Values = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: fromMe(me) })
  const draft = useWatch({ control })

  const save = useMutation({
    mutationFn: (v: Values) =>
      saveProfile({
        display_name: v.display_name.trim(),
        affiliation: v.affiliation.trim() || null,
        biography: v.biography.trim() || null,
        research_interests: parseInterests(v.interests),
        is_public: v.is_public,
        public_fields: PUBLIC_FIELDS.filter((f) => v.shown[f]),
      }),
    onSuccess: async (_saved, v) => {
      await invalidate.me(qc)
      reset(v)
    },
  })

  const isPublic = draft.is_public ?? false
  const shown = (f: PublicField) => isPublic && (draft.shown?.[f] ?? false)
  const interests = parseInterests(draft.interests ?? '')

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit((v) => save.mutate(v))} aria-label={t('settings.tabs.profile')}>
      <Field label={t('settings.profile.name')} requirement="required" error={errors.display_name?.message}>
        <input dir="auto" aria-invalid={errors.display_name ? true : undefined} {...register('display_name')} />
      </Field>
      <Field label={t('settings.profile.interests')} requirement="optional" hint={t('settings.profile.interestsHint')}>
        <textarea rows={2} dir="auto" {...register('interests')} />
      </Field>
      <Field label={t('settings.profile.affiliation')} requirement="optional">
        <input dir="auto" {...register('affiliation')} />
      </Field>
      <Field label={t('settings.profile.biography')} requirement="optional">
        <textarea rows={4} dir="auto" {...register('biography')} />
      </Field>
      <p className={styles.hint}>
        {t('settings.profile.email')}: {me.email} · {t('settings.profile.emailNote')}
      </p>

      <fieldset className={styles.group}>
        <legend>{t('settings.profile.public')}</legend>
        <label className={styles.check}>
          <input type="checkbox" {...register('is_public')} />
          <span>
            {t('settings.profile.publicOn')}
            <small>{isPublic ? t('settings.profile.publicLineOn') : t('settings.profile.publicLineOff')}</small>
          </span>
        </label>
        <div role="group" aria-label={t('settings.profile.showFields')} className={styles.checks}>
          <p className={styles.hint}>{t('settings.profile.nameAlways')}</p>
          {PUBLIC_FIELDS.map((f) => (
            <label key={f} className={styles.check}>
              <input type="checkbox" disabled={!isPublic} {...register(`shown.${f}`)} />
              {t(`settings.profile.fields.${f}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <section className={styles.preview} aria-label={t('settings.profile.preview')}>
        <h3>{t('settings.profile.preview')}</h3>
        {!isPublic ? (
          <NeutralState kind="unknown">{t('settings.profile.previewPrivate')}</NeutralState>
        ) : (
          <dl className={styles.facts}>
            <dt>{t('settings.profile.name')}</dt>
            <dd>
              <BidiText>{draft.display_name ?? ''}</BidiText>
            </dd>
            {shown('research_interests') ? (
              <>
                <dt>{t('settings.profile.fields.research_interests')}</dt>
                <dd>{interests.length > 0 ? <BidiText>{interests.join(' · ')}</BidiText> : <NeutralState kind="unknown">{t('settings.profile.notProvided')}</NeutralState>}</dd>
              </>
            ) : null}
            {shown('affiliation') ? (
              <>
                <dt>{t('settings.profile.fields.affiliation')}</dt>
                <dd>{draft.affiliation?.trim() ? <BidiText>{draft.affiliation}</BidiText> : <NeutralState kind="unknown">{t('settings.profile.notProvided')}</NeutralState>}</dd>
              </>
            ) : null}
            {shown('biography') ? (
              <>
                <dt>{t('settings.profile.fields.biography')}</dt>
                <dd>{draft.biography?.trim() ? <BidiText>{draft.biography}</BidiText> : <NeutralState kind="unknown">{t('settings.profile.notProvided')}</NeutralState>}</dd>
              </>
            ) : null}
            {shown('email') ? (
              <>
                <dt>{t('settings.profile.email')}</dt>
                <dd>{me.email}</dd>
              </>
            ) : null}
          </dl>
        )}
        <p className={styles.hint}>{t('settings.profile.noResearch')}</p>
      </section>

      <MutationNotice error={save.error} title={t('settings.saveFailed')} />
      <div className={styles.saveBar}>
        <Button type="submit" variant="primary" disabled={save.isPending || !isDirty}>
          {save.isPending ? t('settings.saving') : t('settings.save')}
        </Button>
        <span role="status" className={styles.hint}>
          {save.isPending ? '' : isDirty ? t('settings.unsaved') : save.isSuccess ? t('settings.saved') : ''}
        </span>
      </div>
    </form>
  )
}
