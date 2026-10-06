import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { listFamilies, removeMember } from '@/api/families'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import type { Family, FamilyMember } from '@/api/schemas/families'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { MutationNotice } from '@/components/MutationNotice'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { useProject } from '@/features/projects/useProject'
import { useQueryParams } from '@/hooks/useQueryParams'
import { AddMemberDialog, NewFamilyDialog } from './FamilyDialogs'
import { countByRelationship, isRelationship, memberSource, sourceCode, splitMembers } from './familiesModel'
import styles from './Families.module.css'

type Dialog = { kind: 'new' } | { kind: 'add'; family: Family } | { kind: 'remove'; family: Family; member: FamilyMember } | null

/**
 * Screen 28. The families of the project and the one open (?family=). A family groups reports that share a core: its
 * members are pieces of evidence of this project or reports of the corpus, each with the relationship a researcher gave
 * it. The platform suggests nothing (there is no matcher behind this screen) and a family cannot be edited or deleted
 * after it is made (request file C-35); the screen says both.
 */
export function FamiliesPage() {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const qc = useQueryClient()
  const { id: projectId, can } = useProject()
  const url = useQueryParams()
  const [dialog, setDialog] = useState<Dialog>(null)
  const pid = projectId ?? 0
  const canEdit = can('editShared')
  const selected = url.id('family')

  const list = useQuery({ queryKey: qk.project(pid).families, queryFn: ({ signal }) => listFamilies(pid, signal), enabled: projectId !== null })
  const remove = useMutation({
    mutationFn: ({ family, member }: { family: Family; member: FamilyMember }) => removeMember(pid, family.id, member.id),
    onSuccess: async () => {
      await invalidate.familiesChanged(qc, pid)
      setDialog(null)
    },
  })

  if (projectId === null) return null
  const families = list.data ?? []
  const open = families.find((f) => f.id === selected) ?? null
  const view = list.data ? 'normal' : viewStateOf(list)
  const base = `/projects/${projectId}`

  return (
    <section aria-label={t('families.title')}>
      <div className={styles.bar}>
        <h1>{t('families.title')}</h1>
        <p className={styles.sub}>{t('families.sub')}</p>
      </div>
      <p className={styles.note} role="note">
        {t('families.unchecked')}
      </p>

      <StateBoundary state={view} errorValue={list.error} onRetry={() => void list.refetch()}>
        <RefreshNotice query={list} what={t('families.title')} />
        {families.length === 0 ? (
          <div className={styles.empty}>
            <h2>{t('families.empty.title')}</h2>
            <p>{t('families.empty.body')}</p>
            {canEdit ? (
              <Button variant="primary" onClick={() => setDialog({ kind: 'new' })}>
                {t('families.new.open')}
              </Button>
            ) : (
              <p className={styles.meta}>{t('families.readOnly')}</p>
            )}
          </div>
        ) : (
          <div className={styles.split}>
            <div>
              <div className={styles.head}>
                <h2>{t('families.list.title')}</h2>
                {canEdit ? <Button onClick={() => setDialog({ kind: 'new' })}>{t('families.new.open')}</Button> : null}
              </div>
              <ul className={styles.list} aria-label={t('families.list.title')}>
                {families.map((f) => (
                  <li key={f.id}>
                    <button type="button" className={styles.item} aria-current={f.id === selected} onClick={() => url.set({ family: f.id }, { push: true })}>
                      <span className={styles.itemTitle}>
                        <BidiText>{f.canonical_title}</BidiText>
                      </span>
                      <span className={styles.meta}>
                        <span className="mono">{`HF-${String(f.id).padStart(4, '0')}`}</span> · {t('families.list.members', { count: f.members.length })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {!canEdit ? <p className={styles.meta}>{t('families.readOnly')}</p> : null}
            </div>

            <div>
              {open ? (
                <FamilyDetail
                  key={open.id}
                  projectId={projectId}
                  base={base}
                  family={open}
                  canEdit={canEdit}
                  date={date}
                  onAdd={() => setDialog({ kind: 'add', family: open })}
                  onRemove={(member) => setDialog({ kind: 'remove', family: open, member })}
                />
              ) : (
                <div className={styles.empty}>
                  <p>{selected ? t('families.list.notFound') : t('families.list.pick')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </StateBoundary>

      {dialog?.kind === 'new' ? (
        <NewFamilyDialog
          projectId={projectId}
          onClose={() => setDialog(null)}
          onCreated={(family) => {
            setDialog(null)
            url.set({ family: family.id })
          }}
        />
      ) : null}
      {dialog?.kind === 'add' ? <AddMemberDialog projectId={projectId} family={dialog.family} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'remove' ? (
        <ConfirmAction
          open
          danger
          busy={remove.isPending}
          title={t('families.remove.title', { code: sourceCode(memberSource(dialog.member)) })}
          confirmLabel={t('families.remove.confirm')}
          onConfirm={() => remove.mutate({ family: dialog.family, member: dialog.member })}
          onCancel={() => setDialog(null)}
        >
          <p>{t('families.remove.body')}</p>
          <MutationNotice error={remove.error} title={t('families.remove.failed')} />
        </ConfirmAction>
      ) : null}
    </section>
  )
}

function FamilyDetail({ projectId, base, family, canEdit, date, onAdd, onRemove }: { projectId: number; base: string; family: Family; canEdit: boolean; date: (v: string) => string; onAdd: () => void; onRemove: (m: FamilyMember) => void }) {
  const { t } = useTranslation()
  const { reviewed, candidates } = splitMembers(family.members)
  const counts = countByRelationship(family.members)

  const memberRow = (m: FamilyMember) => {
    const source = memberSource(m)
    const code = sourceCode(source)
    const href = source.kind === 'evidence' ? `${base}/evidence?item=${source.id}` : source.kind === 'report' ? `${base}/analysis?view=occ&h=${source.id}` : null
    return (
      <li key={m.id} className={styles.member}>
        <div>
          <strong>{href ? <Link to={href}>{code}</Link> : t('families.member.noSource')}</strong>{' '}
          <span className={styles.rel}>{isRelationship(m.relationship_type) ? t(`families.relationships.${m.relationship_type}`) : m.relationship_type}</span>
          {m.evidence?.captured_text ? (
            <p>
              <BidiText>{m.evidence.captured_text}</BidiText>
            </p>
          ) : null}
          {m.convergence_narrator || m.convergence_depth ? (
            <p className={styles.meta}>
              {t('families.member.converges')}: {m.convergence_narrator ? <BidiText>{m.convergence_narrator}</BidiText> : t('families.member.unknownNarrator')}
              {m.convergence_depth ? ` · ${t('families.member.depth', { depth: m.convergence_depth })}` : ''}
            </p>
          ) : null}
          {m.scholarly_notes ? (
            <p className={styles.meta}>
              <BidiText>{m.scholarly_notes}</BidiText>
            </p>
          ) : null}
          {m.created_at ? <p className={styles.meta}>{t('families.member.added', { date: date(m.created_at) })}</p> : null}
        </div>
        {canEdit ? (
          <div className={styles.actions}>
            <Button onClick={() => onRemove(m)} aria-label={t('families.member.removeOf', { code: code || t('families.member.noSource') })}>
              {t('families.member.remove')}
            </Button>
          </div>
        ) : null}
      </li>
    )
  }

  return (
    <article className={styles.detail} aria-label={family.canonical_title}>
      <p className={styles.meta}>
        <span className="mono">{`HF-${String(family.id).padStart(4, '0')}`}</span>
        {family.creator?.display_name ? <> · {t('families.detail.by', { name: family.creator.display_name })}</> : null}
        {family.created_at ? <> · {date(family.created_at)}</> : null}
      </p>
      <h2>
        <BidiText>{family.canonical_title}</BidiText>
      </h2>
      {family.root_companion ? (
        <p>
          {t('families.detail.companion')}: <BidiText>{family.root_companion}</BidiText>
        </p>
      ) : null}
      {family.core_theme ? (
        <p>
          <BidiText>{family.core_theme}</BidiText>
        </p>
      ) : null}
      <ul className={styles.counts} aria-label={t('families.detail.counts')}>
        {(['mutabaah_tammah', 'mutabaah_qasirah', 'shahid', 'candidate'] as const).map((r) => (
          <li key={r}>
            {t(`families.relationships.${r}`)}: {counts[r]}
          </li>
        ))}
      </ul>

      <div className={styles.head}>
        <h3>{t('families.detail.reviewed')}</h3>
        {canEdit ? (
          <Button variant="primary" onClick={onAdd}>
            {t('families.add.open')}
          </Button>
        ) : null}
      </div>
      {reviewed.length === 0 ? <p className={styles.meta}>{t('families.detail.noReviewed')}</p> : <ul className={styles.members} aria-label={t('families.detail.reviewed')}>{reviewed.map(memberRow)}</ul>}

      <h3>{t('families.detail.candidates')}</h3>
      {candidates.length === 0 ? <p className={styles.meta}>{t('families.detail.noCandidates')}</p> : <ul className={styles.members} aria-label={t('families.detail.candidates')}>{candidates.map(memberRow)}</ul>}
      <p className={styles.meta}>{t('families.detail.limits', { id: projectId })}</p>
    </article>
  )
}
