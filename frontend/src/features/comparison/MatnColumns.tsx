import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { MatnCompareResult, MatnVariant } from '@/api/schemas/analyses'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { detectDirection } from '@/components/direction'
import { markWords, type MarkedWord } from './comparisonModel'
import styles from './Comparison.module.css'

interface Props {
  result: MatnCompareResult
  highlight: boolean
  /** A heading for each text: its source and a second line. Stored runs only know the id. */
  describe: (variant: MatnVariant) => { title: string; sub?: ReactNode }
  /** What goes under a column (the live view puts the researcher notes there). */
  footer?: (variant: MatnVariant) => ReactNode
  onBaseline?: (id: string) => void
}

/**
 * The compared texts side by side in their original wording, with the words that only some of the texts have marked
 * (when asked), and what the comparison counted. The server compares which words each text has, not where they
 * stand, so the marks say "this word is missing from at least one text" and nothing about order (request file C-19).
 */
export function MatnColumns({ result, highlight, describe, footer, onBaseline }: Props) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const shared = new Set(result.consensus_core_tokens)
  const baseline = String(result.baseline_id ?? result.variants[0]?.id ?? '')
  const label = (v: MatnVariant) => describe(v).title

  return (
    <>
      <div className={styles.columns}>
        {result.variants.map((v) => {
          const id = String(v.id)
          const head = describe(v)
          const marked = highlight && v.raw_text.trim() !== '' ? markWords(v.raw_text, v.tokens, shared) : null
          const diff = result.diff_against_baseline?.[id]
          return (
            <article key={id} className={styles.column} aria-label={head.title}>
              <header className={styles.columnHead}>
                <h3>{head.title}</h3>
                {head.sub ? <span className={styles.hint}>{head.sub}</span> : null}
              </header>

              {v.raw_text.trim() === '' ? (
                <div className={styles.notice} role="note">
                  <NeutralState kind="limitation" />
                  <p>{t('comparison.occ.limited')}</p>
                </div>
              ) : (
                <>
                  {marked ? (
                    <MarkedWording raw={v.raw_text} words={marked} />
                  ) : (
                    <BidiText as="p" className={styles.wording}>
                      {v.raw_text}
                    </BidiText>
                  )}
                  {highlight && !marked ? <p className={styles.hint}>{t('comparison.occ.noMarks')}</p> : null}
                </>
              )}

              <p className={styles.stats}>
                <span>
                  {t('comparison.occ.words', {
                    count: v.token_count,
                    formattedCount: n(v.token_count),
                  })}
                </span>
                <span>
                  {t('comparison.occ.onlyHere', {
                    count: result.unique_words_summary[id]?.unique_count ?? 0,
                    formattedCount: n(result.unique_words_summary[id]?.unique_count ?? 0),
                  })}
                </span>
              </p>
              {id === baseline ? (
                <p className={styles.stats}>
                  <strong>{t('comparison.occ.baseline')}</strong>
                </p>
              ) : (
                <p className={styles.stats}>
                  {diff ? (
                    <span>
                      {t('comparison.occ.againstBaseline', {
                        added: n(diff.additions.length),
                        missing: n(diff.deletions.length),
                      })}
                    </span>
                  ) : null}
                  {onBaseline ? (
                    <Button variant="ghost" onClick={() => onBaseline(id)}>
                      {t('comparison.occ.makeBaseline')}
                    </Button>
                  ) : null}
                </p>
              )}
              {footer?.(v)}
            </article>
          )
        })}
      </div>

      <section className={styles.summary} aria-label={t('comparison.occ.summary')}>
        <h3>{t('comparison.occ.summary')}</h3>
        <p>
          {t('comparison.occ.core', {
            count: result.consensus_core_count,
            formattedCount: n(result.consensus_core_count),
          })}
        </p>
        <p className={styles.hint}>{t('comparison.occ.method')}</p>
        <table className={styles.table}>
          <caption className={styles.hint}>{t('comparison.occ.overlap')}</caption>
          <thead>
            <tr>
              <th scope="col" />
              {result.variants.map((v) => (
                <th key={String(v.id)} scope="col">
                  {label(v)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.variants.map((row) => (
              <tr key={String(row.id)}>
                <th scope="row">{label(row)}</th>
                {result.variants.map((col) => (
                  <td key={String(col.id)} className={styles.cellNum}>
                    {t('comparison.occ.percent', {
                      value: n(result.similarity_matrix[String(row.id)]?.[String(col.id)] ?? 0),
                    })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

/** The wording with the words that some texts lack marked; the letters are exactly the source's. */
function MarkedWording({ raw, words }: { raw: string; words: MarkedWord[] }) {
  const direction = detectDirection(raw)
  return (
    <p
      className={styles.wording}
      dir={direction ?? 'auto'}
      style={{
        unicodeBidi: 'isolate',
        ...(direction === 'rtl' ? { fontFamily: 'var(--font-arabic)' } : {}),
      }}
    >
      {words.map((w, i) =>
        w.role === 'some' ? (
          <span key={i} className={styles.wordSome}>
            {w.text}
          </span>
        ) : (
          w.text
        ),
      )}
    </p>
  )
}
