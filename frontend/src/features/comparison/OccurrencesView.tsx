import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BidiText } from '@/components/BidiText'
import type { OccurrenceColumn } from './comparisonModel'
import styles from './Comparison.module.css'

interface OccurrencesViewProps {
  columns: OccurrenceColumn[]
  showDiff: boolean
  onToggleDiff: () => void
  onAnnotate: (colId: number | string) => void
  projectId: number
}

export function OccurrencesView({
  columns,
  showDiff,
  onToggleDiff,
  onAnnotate,
  projectId,
}: OccurrencesViewProps) {
  const { t } = useTranslation()

  return (
    <div className={styles.occView}>
      <div className={styles.occHeaderBar}>
        <span className={styles.occSummaryText}>
          {t('comparison.occ.summary', {
            count: columns.length,
            report: 'REP-000318',
          })}
        </span>
        <label className={styles.diffToggleLabel}>
          <input
            type="checkbox"
            checked={showDiff}
            onChange={onToggleDiff}
            aria-label={t('comparison.occ.highlightDiff')}
          />
          {t('comparison.occ.highlightDiff')}
        </label>
      </div>

      <div
        role="region"
        aria-label="Side-by-side occurrences, scrolls horizontally"
        tabIndex={0}
        className={styles.occScrollRegion}
      >
        <div
          className={styles.occGrid}
          style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 3)}, minmax(260px, 1fr))` }}
        >
          {columns.map((col) => (
            <article key={col.id} className={styles.occCol}>
              <header className={styles.occColHeader}>
                <span className={styles.occBookTitle}>{col.book}</span>
                <span className={styles.occLocator}>{col.loc}</span>
                <Link
                  to={`/projects/${projectId}/evidence`}
                  className={styles.occEvLink}
                >
                  {col.ev}
                </Link>
              </header>

              {col.limited ? (
                <div className={styles.limitationNotice}>
                  <span className={styles.limitationKicker}>
                    {t('comparison.occ.limitationTitle')}
                  </span>
                  <span>{t('comparison.occ.limitationBody')}</span>
                </div>
              ) : null}

              {col.hasText && !col.limited ? (
                <>
                  <div className={styles.sourceBlock}>
                    <span className={styles.sourceKicker}>
                      ❝ {t('comparison.occ.sourceHeader')}
                    </span>
                    <p className={styles.matnArabic}>
                      {col.segs.map((s, idx) => {
                        const isHighlighted = showDiff && s.diff
                        const isUnderlined = s.note
                        const classes = [
                          isHighlighted ? styles.diffHighlight : '',
                          isUnderlined ? styles.annotationUnderline : '',
                        ]
                          .filter(Boolean)
                          .join(' ')

                        return (
                          <BidiText
                            key={idx}
                            as="span"
                            className={classes || undefined}
                          >
                            {s.t}
                          </BidiText>
                        )
                      })}
                    </p>
                  </div>

                  <div className={styles.notesCol}>
                    {col.notes.map((n, i) => (
                      <Link
                        key={i}
                        to={`/projects/${projectId}/evidence`}
                        className={styles.noteItem}
                      >
                        <span className={styles.noteKicker}>
                          ✎ Researcher note · {n.vis}
                        </span>
                        <span className={styles.noteText}>{n.text}</span>
                      </Link>
                    ))}
                    <button
                      type="button"
                      onClick={() => onAnnotate(col.id)}
                      className={styles.annotateBtn}
                    >
                      {t('comparison.occ.annotateDiff')}
                    </button>
                  </div>
                </>
              ) : null}
            </article>
          ))}
        </div>
      </div>

      <div className={styles.occLegend}>
        <span className={styles.legendItem}>
          <span className={styles.legendSwatchDiff} aria-hidden="true" />
          {t('comparison.occ.legendDiff')}
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendSwatchAnnotated} aria-hidden="true" />
          {t('comparison.occ.legendAnnotation')}
        </span>
      </div>
    </div>
  )
}
