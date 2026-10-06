import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { listCases, updateCase } from '@/api/ilal'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import { CASE_STATUSES, type CaseStatus, type IlalCase } from '@/api/schemas/ilal'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { MutationNotice } from '@/components/MutationNotice'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { useProject } from '@/features/projects/useProject'
import { useQueryParams } from '@/hooks/useQueryParams'
import { AddCriticDialog, AddVariantDialog, NewCaseDialog } from './IlalDialogs'
import { canResolve, caseCode, criticText, isCaseStatus, isDiscrepancy, preferredIndex, variantLabel } from './ilalModel'
import styles from './Ilal.module.css'

type Dialog = { kind: 'new' } | { kind: 'variant'; kase: IlalCase } | { kind: 'critic'; kase: IlalCase } | null

/**
 * Screen 29. The ʿilal cases of the project and the one open (?case=). A case compares two or more versions of a report,
 * records what critics said, and keeps the researchers' conclusion. The platform grades nothing: "resolved" is the
 * researchers' preference between versions and the screen says so. Objections, replies and a change history are in the
 * design but not on the server (request file C-36), so they are not drawn.
 */
export function IlalPage() {
  const { t } = useTranslation()
  const { id: projectId, can } = useProject()
  const url = useQueryParams()
  const [dialog, setDialog] = useState<Dialog>(null)
  const pid = projectId ?? 0
  const canEdit = can('editShared')
  const selected = url.id('case')

  const list = useQuery({ queryKey: qk.project(pid).ilal, queryFn: ({ signal }) => listCases(pid, signal), enabled: projectId !== null })
  if (projectId === null) return null
  const cases = list.data ?? []
  const open = cases.find((c) => c.id === selected) ?? null
  const view = list.data ? 'normal' : viewStateOf(list)

  return (
    <section aria-label={t('ilal.title')}>
      <div className={styles.bar}>
        <h1>{t('ilal.title')}</h1>
        <p className={styles.sub}>{t('ilal.sub')}</p>
      </div>
      <p className={styles.note} role="note">
        {t('ilal.unchecked')}
      </p>
      <StateBoundary state={view} errorValue={list.error} onRetry={() => void list.refetch()}>
        <RefreshNotice query={list} what={t('ilal.title')} />
        {cases.length === 0 ? (
          <div className={styles.empty}>
            <h2>{t('ilal.empty.title')}</h2>
            <p>{t('ilal.empty.body')}</p>
            {canEdit ? (
              <Button variant="primary" onClick={() => setDialog({ kind: 'new' })}>
                {t('ilal.new.open')}
              </Button>
            ) : (
              <p className={styles.meta}>{t('ilal.readOnly')}</p>
            )}
          </div>
        ) : (
          <div className={styles.split}>
            <div>
              <div className={styles.head}>
                <h2>{t('ilal.list.title')}</h2>
                {canEdit ? <Button onClick={() => setDialog({ kind: 'new' })}>{t('ilal.new.open')}</Button> : null}
              </div>
              <ul className={styles.list} aria-label={t('ilal.list.title')}>
                {cases.map((c) => (
                  <li key={c.id}>
                    <button type="button" className={styles.item} aria-current={c.id === selected} onClick={() => url.set({ case: c.id }, { push: true })}>
                      <span className={styles.itemTitle}>
                        <BidiText>{c.title}</BidiText>
                      </span>
                      <span className={styles.meta}>
                        <span className="mono">{caseCode(c.id)}</span> · {isCaseStatus(c.status) ? t(`ilal.statuses.${c.status}`) : c.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {!canEdit ? <p className={styles.meta}>{t('ilal.readOnly')}</p> : null}
            </div>
            <div>
              {open ? (
                <CaseDetail
                  key={open.id}
                  projectId={projectId}
                  kase={open}
                  canEdit={canEdit}
                  onVariant={() => setDialog({ kind: 'variant', kase: open })}
                  onCritic={() => setDialog({ kind: 'critic', kase: open })}
                />
              ) : (
                <div className={styles.empty}>
                  <p>{selected ? t('ilal.list.notFound') : t('ilal.list.pick')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </StateBoundary>

      {dialog?.kind === 'new' ? (
        <NewCaseDialog
          projectId={projectId}
          onClose={() => setDialog(null)}
          onCreated={(made) => {
            setDialog(null)
            url.set({ case: made.id })
          }}
        />
      ) : null}
      {dialog?.kind === 'variant' ? <AddVariantDialog projectId={projectId} kase={dialog.kase} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'critic' ? <AddCriticDialog projectId={projectId} kase={dialog.kase} onClose={() => setDialog(null)} /> : null}
    </section>
  )
}

function CaseDetail({ projectId, kase, canEdit, onVariant, onCritic }: { projectId: number; kase: IlalCase; canEdit: boolean; onVariant: () => void; onCritic: () => void }) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const preferred = preferredIndex(kase)
  const strayPreferred = (kase.preferred_version ?? '').trim() !== '' && preferred === -1

  return (
    <article className={styles.detail} aria-label={kase.title}>
      <p className={styles.meta}>
        <span className="mono">{caseCode(kase.id)}</span>
        {kase.creator?.display_name ? <> · {t('ilal.detail.by', { name: kase.creator.display_name })}</> : null}
        {kase.created_at ? <> · {date(kase.created_at)}</> : null}
      </p>
      <h2>
        <BidiText>{kase.title}</BidiText>
      </h2>
      <p>
        {t('ilal.detail.discrepancy')}: {isDiscrepancy(kase.discrepancy_category) ? t(`ilal.categories.${kase.discrepancy_category}`) : kase.discrepancy_category}
      </p>

      <div className={styles.head}>
        <h3>{t('ilal.detail.versions')}</h3>
        {canEdit ? <Button onClick={onVariant}>{t('ilal.variant.open')}</Button> : null}
      </div>
      {kase.competing_variants.length === 0 ? (
        <p className={styles.meta}>{t('ilal.detail.noVersions')}</p>
      ) : (
        <ul className={styles.variants} aria-label={t('ilal.detail.versions')}>
          {kase.competing_variants.map((v, i) => (
            <li key={`${variantLabel(v, i)}-${i}`} className={`${styles.variant} ${i === preferred ? styles.preferred : ''}`}>
              <strong>
                <BidiText>{variantLabel(v, i)}</BidiText>
              </strong>{' '}
              {i === preferred ? <span className={styles.rel}>{t('ilal.detail.preferred')}</span> : null}
              {v.matn ? (
                <p>
                  <BidiText>{v.matn}</BidiText>
                </p>
              ) : null}
              {v.chain ? (
                <p className={styles.meta}>
                  <BidiText>{v.chain}</BidiText>
                </p>
              ) : null}
              {v.state ? <p className={styles.meta}>{v.state}</p> : null}
              {v.note ? (
                <p className={styles.meta}>
                  <BidiText>{v.note}</BidiText>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {kase.competing_variants.length === 1 ? <p className={styles.meta}>{t('ilal.detail.needTwo')}</p> : null}

      <div className={styles.head}>
        <h3>{t('ilal.detail.critics')}</h3>
        {canEdit ? <Button onClick={onCritic}>{t('ilal.critic.open')}</Button> : null}
      </div>
      {kase.critics_judgments.length === 0 ? (
        <p className={styles.meta}>{t('ilal.detail.noCritics')}</p>
      ) : (
        <ul className={styles.members} aria-label={t('ilal.detail.critics')}>
          {kase.critics_judgments.map((c, i) => (
            <li key={i} className={styles.member}>
              <div>
                <strong>
                  <BidiText>{c.critic ?? t('ilal.detail.unnamedCritic')}</BidiText>
                </strong>
                {c.favours ? <span className={styles.meta}> · {t('ilal.detail.favours', { version: c.favours })}</span> : null}
                <p>
                  <BidiText>{criticText(c)}</BidiText>
                </p>
                {c.source ? (
                  <p className={styles.meta}>
                    <BidiText>{c.source}</BidiText>
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3>{t('ilal.detail.conclusion')}</h3>
      <p className={styles.meta}>{t('ilal.detail.notAGrade')}</p>
      {strayPreferred ? (
        <p className={styles.meta}>
          {t('ilal.detail.strayPreferred')} <BidiText>{kase.preferred_version ?? ''}</BidiText>
        </p>
      ) : null}
      {canEdit ? (
        <ConclusionForm key={`${kase.id}-${kase.updated_at ?? ''}`} projectId={projectId} kase={kase} />
      ) : (
        <ConclusionReadOnly kase={kase} />
      )}
      <p className={styles.meta}>{t('ilal.detail.limits')}</p>
    </article>
  )
}

function ConclusionReadOnly({ kase }: { kase: IlalCase }) {
  const { t } = useTranslation()
  return (
    <div className={styles.conclusion}>
      <p>
        {t('ilal.conclusion.status')}: {isCaseStatus(kase.status) ? t(`ilal.statuses.${kase.status}`) : kase.status}
      </p>
      {kase.resolution_notes ? (
        <p>
          <BidiText>{kase.resolution_notes}</BidiText>
        </p>
      ) : (
        <p className={styles.meta}>{t('ilal.conclusion.noNotes')}</p>
      )}
    </div>
  )
}

interface ConclusionValues {
  status: CaseStatus
  preferred: string
  notes: string
}

function ConclusionForm({ projectId, kase }: { projectId: number; kase: IlalCase }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const resolvable = canResolve(kase)
  const {
    register,
    handleSubmit,
    formState: { isDirty },
  } = useForm<ConclusionValues>({
    defaultValues: { status: isCaseStatus(kase.status) ? kase.status : 'under_investigation', preferred: kase.preferred_version ?? '', notes: kase.resolution_notes ?? '' },
  })
  const save = useMutation({
    mutationFn: (v: ConclusionValues) => updateCase(projectId, kase.id, { status: v.status, preferred_version: v.preferred, resolution_notes: v.notes.trim() }),
    onSuccess: () => invalidate.ilalChanged(qc, projectId),
  })
  return (
    <form noValidate className={styles.conclusion} onSubmit={handleSubmit((v) => save.mutate(v))}>
      <Field label={t('ilal.conclusion.status')} requirement="required" hint={resolvable ? undefined : t('ilal.conclusion.needTwo')}>
        <select {...register('status')}>
          {CASE_STATUSES.map((s) => (
            <option key={s} value={s} disabled={!resolvable && (s === 'resolved_authentic' || s === 'resolved_defective')}>
              {t(`ilal.statuses.${s}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('ilal.conclusion.preferred')} requirement="optional" hint={t('ilal.conclusion.preferredHint')}>
        <select {...register('preferred')} disabled={!resolvable}>
          <option value="">{t('ilal.conclusion.none')}</option>
          {kase.competing_variants.map((v, i) => (
            <option key={`${variantLabel(v, i)}-${i}`} value={variantLabel(v, i)}>
              {variantLabel(v, i)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('ilal.conclusion.notes')} requirement="optional" hint={t('ilal.conclusion.notesHint')}>
        <textarea rows={4} dir="auto" {...register('notes')} />
      </Field>
      <MutationNotice error={save.error} title={t('ilal.conclusion.failed')} />
      <div>
        <Button type="submit" variant="primary" disabled={!isDirty || save.isPending}>
          {t('ilal.conclusion.save')}
        </Button>
      </div>
    </form>
  )
}
