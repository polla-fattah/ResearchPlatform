import { useTranslation } from 'react-i18next'
import { BidiText } from '@/components/BidiText'
import { isProjectStage } from '@/domain/vocab'
import styles from './Announcement.module.css'

interface Props {
  title: string
  summary: string
  stage: string
  keywords: readonly string[]
  /** What the project itself contributes to the public page: its title, scope and the owner's name. */
  project: { title: string; scope: string | null; owner: string | null }
}

/**
 * What a visitor would see, drawn from the values on the form, so it is the page before it is saved. It shows only the
 * fields the server's public answer carries; nothing else of the project can be on it.
 */
export function PublicPreview({ title, summary, stage, keywords, project }: Props) {
  const { t } = useTranslation()
  return (
    <section className={styles.preview} aria-label={t('announcement.preview.title')}>
      <p className={styles.label}>{t('announcement.public.label')}</p>
      <h3>
        <BidiText>{title.trim() || t('announcement.preview.noTitle')}</BidiText>
      </h3>
      <p className={styles.summary}>
        <BidiText>{summary.trim() || t('announcement.preview.noSummary')}</BidiText>
      </p>
      <dl className={styles.facts}>
        <dt>{t('announcement.preview.project')}</dt>
        <dd>
          <BidiText>{project.title}</BidiText>
        </dd>
        <dt>{t('announcement.preview.scope')}</dt>
        <dd>{project.scope ? <BidiText>{project.scope}</BidiText> : <span className={styles.hint}>{t('announcement.preview.noScope')}</span>}</dd>
        <dt>{t('announcement.preview.stage')}</dt>
        <dd>{isProjectStage(stage) ? t(`stage.${stage}`) : stage}</dd>
        <dt>{t('announcement.preview.keywords')}</dt>
        <dd>{keywords.length > 0 ? keywords.map((k) => <span key={k}>{k} </span>) : <span className={styles.hint}>{t('announcement.preview.noKeywords')}</span>}</dd>
        <dt>{t('announcement.preview.by')}</dt>
        <dd>{project.owner ? <BidiText>{project.owner}</BidiText> : '—'}</dd>
      </dl>
    </section>
  )
}
