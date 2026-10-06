import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { evidenceKeys, linkFinding, listFindingOptions, unlinkFinding } from '@/api/evidence'
import { userMessage } from '@/api/errors'
import { RELATIONS, type Dependencies, type Relation } from '@/api/schemas/evidence'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { formatCode } from '@/domain/codes'
import { evidenceCode } from './evidenceModel'
import styles from './Evidence.module.css'

interface Props {
  projectId: number
  evidenceId: number
  deps: Dependencies | undefined
  depsFailed: boolean
  canEdit: boolean
}

/** Findings that use this evidence, and the documents that cite it. */
export function FindingsPanel({ projectId, evidenceId, deps, depsFailed, canEdit }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [findingId, setFindingId] = useState('')
  const [relation, setRelation] = useState<Relation>('supporting')
  const [interpretation, setInterpretation] = useState('')
  const [error, setError] = useState<string | null>(null)

  const options = useQuery({
    queryKey: evidenceKeys.findings(projectId),
    queryFn: ({ signal }) => listFindingOptions(projectId, signal),
    enabled: open,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: evidenceKeys.deps(projectId, evidenceId) })

  const link = useMutation({
    mutationFn: () => linkFinding(projectId, Number(findingId), evidenceId, relation, interpretation.trim()),
    onSuccess: async () => {
      await refresh()
      setOpen(false)
      setFindingId('')
      setInterpretation('')
    },
  })
  const unlink = useMutation({
    mutationFn: (fid: number) => unlinkFinding(projectId, fid, evidenceId),
    onMutate: () => setError(null),
    onSuccess: () => refresh(),
    onError: (err) => setError(`${t('evidence.findings.unlinkFailed')}. ${userMessage(err, t('states.error.body'))}`),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (findingId) link.mutate()
  }

  const linkedIds = new Set((deps?.findings ?? []).map((f) => f.id))
  const choices = (options.data ?? []).filter((f) => !linkedIds.has(f.id))

  return (
    <>
      <section className={styles.section} aria-label={t('evidence.findings.heading')}>
        <h3>{t('evidence.findings.heading')}</h3>
        {depsFailed ? <p role="alert">{t('evidence.findings.loadFailed')}</p> : null}
        {error ? (
          <p role="alert" className={styles.bad}>
            {error}
          </p>
        ) : null}
        {deps && deps.findings.length === 0 ? <p className={styles.hint}>{t('evidence.findings.none')}</p> : null}
        <ul className={styles.plainList}>
          {(deps?.findings ?? []).map((f) => (
            <li key={f.id} className={styles.findingRow}>
              <span>
                <span className="mono">{formatCode('F', f.id)}</span> <BidiText>{f.claim}</BidiText>
              </span>
              <span className={styles.relation}>
                {t(`evidence.findings.relation.${f.pivot?.relation_type ?? 'unresolved'}`, { defaultValue: f.pivot?.relation_type ?? '' })}
              </span>
              {canEdit ? (
                <Button
                  variant="ghost"
                  disabled={unlink.isPending}
                  onClick={() => unlink.mutate(f.id)}
                  aria-label={`${t('evidence.findings.unlink')} ${formatCode('F', f.id)}`}
                >
                  {t('evidence.findings.unlink')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {canEdit ? <Button onClick={() => setOpen(true)}>{t('evidence.findings.link')}</Button> : null}
      </section>

      <section className={styles.section} aria-label={t('evidence.usedIn.heading')}>
        <h3>{t('evidence.usedIn.heading')}</h3>
        {deps && deps.documents.length === 0 ? <p className={styles.hint}>{t('evidence.usedIn.none')}</p> : null}
        <ul className={styles.plainList}>
          {(deps?.documents ?? []).map((d) => (
            <li key={d.id}>
              <Link to={`/projects/${projectId}/findings`}>
                <BidiText>{d.title}</BidiText>
              </Link>{' '}
              <span className={styles.hint}>
                v{d.version_number ?? 1}
                {d.citation_type ? ` · ${t(`evidence.usedIn.citation.${d.citation_type}`, { defaultValue: d.citation_type })}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {open ? (
        <Modal title={t('evidence.findings.dialogTitle', { code: evidenceCode(evidenceId) })} onClose={() => setOpen(false)}>
          <form className={styles.dialogForm} onSubmit={submit}>
            {options.isPending ? <p role="status">{t('states.loading.label')}</p> : null}
            {options.isError ? <p role="alert">{t('evidence.findings.loadFailed')}</p> : null}
            {options.data && choices.length === 0 ? <p>{t('evidence.findings.noFindings')}</p> : null}
            {choices.length > 0 ? (
              <>
                <Field label={t('evidence.findings.finding')} requirement="required">
                  <select value={findingId} onChange={(e) => setFindingId(e.target.value)}>
                    <option value="" />
                    {choices.map((f) => (
                      <option key={f.id} value={f.id}>
                        {formatCode('F', f.id)} · {f.claim.slice(0, 80)}
                      </option>
                    ))}
                  </select>
                </Field>
                <div role="radiogroup" aria-label={t('evidence.findings.relationLabel')} className={styles.visRow}>
                  {RELATIONS.map((r) => (
                    <label key={r} className={styles.visOption}>
                      <input type="radio" name="relation" checked={relation === r} onChange={() => setRelation(r)} />
                      {t(`evidence.findings.relation.${r}`)}
                    </label>
                  ))}
                </div>
                <Field label={t('evidence.findings.interpretation')}>
                  <textarea rows={2} value={interpretation} onChange={(e) => setInterpretation(e.target.value)} />
                </Field>
              </>
            ) : null}
            <p className={styles.hint}>{t('evidence.findings.note')}</p>
            {link.isError ? (
              <p role="alert" className={styles.bad}>
                <strong>{t('evidence.findings.failed')}.</strong> {userMessage(link.error, t('states.error.body'))}
              </p>
            ) : null}
            <div className={styles.dialogActions}>
              <Button onClick={() => setOpen(false)} disabled={link.isPending}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={!findingId || link.isPending}>
                {t('evidence.findings.submit')}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  )
}
