import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { IsnadChain, IsnadCompareResult } from '@/api/schemas/analyses'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { formatCode } from '@/domain/codes'
import { narratorCode } from './comparisonModel'
import styles from './Comparison.module.css'

interface Props {
  result: IsnadCompareResult
  /** A heading for each chain. Stored runs only know the chain's id. */
  describe?: (chain: IsnadChain) => string
  onOpenDossier?: (narratorId: number) => void
}

/**
 * The chains side by side, from the narrator nearest the compiler (top) to the earliest source (bottom). Narrators
 * who are in every chain, or in several, are marked. Selecting a narrator shows what is known about them here.
 * The comparison reports neither uncertain order, nor unknown narrators, nor ambiguous names, so none is marked and
 * the screen says so rather than leaving the reader to assume there are none (request file C-19).
 */
export function ChainColumns({ result, describe, onOpenDossier }: Props) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const [picked, setPicked] = useState<number | null>(null)

  const total = result.chain_count
  const frequency = new Map<number, number>()
  for (const link of [...result.common_links, ...result.partial_common_links]) frequency.set(link.id, link.frequency)
  const nodes = result.chains.flatMap((c) => c.narrators)
  const selected = nodes.find((x) => x.narrator_id === picked) ?? null

  return (
    <div className={styles.chainsLayout}>
      <div>
        <p className={styles.hint}>
          {t('comparison.chains.caption', {
            count: total,
            formattedCount: n(total),
          })}
        </p>
        {result.divergence_order ? (
          <p>
            {t('comparison.chains.divergence', {
              position: n(result.divergence_order),
            })}
          </p>
        ) : (
          <p>{t('comparison.chains.noDivergence')}</p>
        )}
        <div className={styles.chainRow}>
          {result.chains.map((chain) => (
            <section key={chain.sanad_id} className={styles.chain} aria-label={describe?.(chain) ?? formatCode('CH', chain.sanad_id)}>
              <h3>{describe?.(chain) ?? formatCode('CH', chain.sanad_id)}</h3>
              <p className={styles.hint}>
                {t('comparison.chains.length', {
                  count: chain.length,
                  formattedCount: n(chain.length),
                })}
              </p>
              <ol className={styles.links}>
                {chain.narrators.map((node) => {
                  const freq = frequency.get(node.narrator_id) ?? 1
                  const kind = freq >= total ? styles.nodeEvery : freq >= 2 ? styles.nodeSome : ''
                  return (
                    <li key={node.order} className={styles.link}>
                      {node.connector ? <span className={styles.connector}>{node.connector}</span> : null}
                      <button
                        type="button"
                        className={[styles.node, kind].join(' ')}
                        aria-pressed={picked === node.narrator_id}
                        onClick={() => setPicked(node.narrator_id)}
                      >
                        <BidiText>{node.name}</BidiText>
                        <span className={styles.hint}>
                          <span className={styles.mono}>{narratorCode(node.narrator_id)}</span>
                          {freq >= total
                            ? ` · ${t('comparison.chains.inEvery')}`
                            : freq >= 2
                              ? ` · ${t('comparison.chains.inSome', { count: freq, total, formattedCount: n(freq) })}`
                              : ''}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
        <p className={styles.notice} role="note">
          {t('comparison.chains.unreported')}
        </p>
      </div>

      <aside className={styles.inspector} aria-label={t('comparison.chains.inspector')}>
        {selected ? (
          <>
            <h3>
              <BidiText>{selected.name}</BidiText>
            </h3>
            <p className={styles.mono}>{narratorCode(selected.narrator_id)}</p>
            <p>
              {t('comparison.chains.appearsIn', {
                count: frequency.get(selected.narrator_id) ?? 1,
                total,
                formattedCount: n(frequency.get(selected.narrator_id) ?? 1),
                formattedTotal: n(total),
              })}
            </p>
            <p>
              {t('comparison.chains.generation')}:{' '}
              {typeof selected.tabaqah === 'string' && selected.tabaqah ? selected.tabaqah : <NeutralState kind="unknown" />}
            </p>
            {onOpenDossier ? (
              <Button onClick={() => onOpenDossier(selected.narrator_id)}>{t('comparison.chains.openDossier')}</Button>
            ) : null}
          </>
        ) : (
          <p className={styles.hint}>{t('comparison.chains.pick')}</p>
        )}
      </aside>
    </div>
  )
}
