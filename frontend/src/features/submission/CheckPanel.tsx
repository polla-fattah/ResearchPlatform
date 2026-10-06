import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Issue } from '@/api/schemas/submission'
import { Button } from '@/components/Button'
import { BidiText } from '@/components/BidiText'
import { errorsOf, issueHref, warningsOf } from './submissionModel'
import styles from './Submission.module.css'

interface Props {
  projectId: number
  /** The check for the documents chosen; null while it runs or when nothing is chosen. */
  issues: readonly Issue[] | null
  loading: boolean
  failed: boolean
  chosen: boolean
  onRetry: () => void
}

/** The server's pre-publication check, in words: what must be fixed (errors), what is only noted (warnings), where to fix it. */
export function CheckPanel({ projectId, issues, loading, failed, chosen, onRetry }: Props) {
  const { t } = useTranslation()
  if (!chosen) return <p className={styles.hint}>{t('submission.check.choose')}</p>
  if (loading) return <p className={styles.hint}>{t('submission.check.running')}</p>
  if (failed) {
    return (
      <div role="alert" className={styles.issues}>
        <p>{t('submission.check.failed')}</p>
        <Button onClick={onRetry}>{t('common.retry')}</Button>
      </div>
    )
  }
  const list = issues ?? []
  const errors = errorsOf(list)
  const warnings = warningsOf(list)
  if (list.length === 0) return <p role="status">{t('submission.check.clean')}</p>

  const line = (i: Issue, kind: 'err' | 'warn') => {
    const href = issueHref(projectId, i)
    return (
      <li key={`${i.code}-${i.document_id ?? ''}-${i.citation_id ?? ''}-${i.user_id ?? ''}`}>
        <span className={[styles.sev, kind === 'err' ? styles.err : ''].join(' ')}>{kind === 'err' ? t('submission.check.mustFix') : t('submission.check.note')}</span>
        <BidiText>{t(`submission.check.codes.${i.code}`, { defaultValue: i.message ?? i.code })}</BidiText>{' '}
        {href ? <Link to={href}>{t('submission.check.fix')}</Link> : null}
      </li>
    )
  }
  return (
    <div role="status">
      <p>
        <strong>{errors.length > 0 ? t('submission.check.cannot', { count: errors.length }) : t('submission.check.canWithNotes')}</strong>
      </p>
      <ul className={styles.issues}>
        {errors.map((i) => line(i, 'err'))}
        {warnings.map((i) => line(i, 'warn'))}
      </ul>
    </div>
  )
}
