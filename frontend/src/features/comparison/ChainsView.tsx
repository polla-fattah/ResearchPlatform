import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BidiText } from '@/components/BidiText'
import {
  DEFAULT_AMB_CANDIDATES,
  type AmbiguityCandidate,
  type ChainColumn,
  type ChainLink,
} from './comparisonModel'
import styles from './Comparison.module.css'

interface ChainsViewProps {
  chains: ChainColumn[]
  onOpenDossier: (narratorName: string) => void
}

export function ChainsView({ chains, onOpenDossier }: ChainsViewProps) {
  const { t } = useTranslation()

  // Selected link for inspector: 'amb' or narrator name
  const [selectedItem, setSelectedItem] = useState<{
    type: 'amb' | 'person'
    name: string
    sub?: string
    code?: string
  }>({
    type: 'amb',
    name: 'Sufyān',
    code: 'AMB-0091',
  })

  const [ambCandidates] = useState<AmbiguityCandidate[]>(DEFAULT_AMB_CANDIDATES)

  const handleSelectLink = (link: ChainLink) => {
    if (link.amb) {
      setSelectedItem({
        type: 'amb',
        name: link.name,
        code: link.ambCode ?? 'AMB-0091',
      })
    } else {
      setSelectedItem({
        type: 'person',
        name: link.name,
        sub: link.sub,
        code: link.sub.startsWith('NAR-') ? link.sub : 'Identity record',
      })
    }
  }

  return (
    <div className={styles.chainsLayout}>
      <div className={styles.chainsMain}>
        <span className={styles.occSummaryText}>
          {t('comparison.chains.summary', { count: chains.length })}
        </span>

        <div
          role="region"
          aria-label="Chains side by side, scrolls horizontally"
          tabIndex={0}
          className={styles.chainsScrollRegion}
        >
          <div
            className={styles.chainsGrid}
            style={{ gridTemplateColumns: `repeat(${Math.max(chains.length, 3)}, minmax(210px, 1fr))` }}
          >
            {chains.map((chain, cIdx) => (
              <div key={chain.id || cIdx} className={styles.chainCol}>
                <div className={styles.chainHeader}>
                  <span className={styles.chainBookName}>{chain.book}</span>
                  <span className={styles.chainMeta}>
                    {chain.id} · {chain.n}
                  </span>
                </div>

                <ol className={styles.chainList}>
                  {chain.links.map((link, lIdx) => {
                    const isSelected =
                      selectedItem.name === link.name ||
                      (selectedItem.type === 'amb' && link.amb)
                    const isDashed = link.amb || link.unknown

                    return (
                      <li key={lIdx} className={styles.chainLinkItem}>
                        {link.formula ? (
                          <span
                            className={[
                              styles.connectorLine,
                              link.uncertain ? styles.connectorLineUncertain : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            <span className={styles.connectorFormula}>
                              <BidiText>{link.formula}</BidiText>
                            </span>
                            {link.uncertain ? (
                              <span className={styles.uncertainBadge}>
                                {t('comparison.chains.uncertainOrder')}
                              </span>
                            ) : null}
                          </span>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleSelectLink(link)}
                          className={[
                            styles.narratorBtn,
                            isSelected ? styles.narratorBtnSelected : '',
                            isDashed ? styles.narratorBtnDashed : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <span className={styles.narratorBtnName}>{link.name}</span>
                          <span className={styles.narratorBtnSub}>{link.sub}</span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside aria-label="Inspector" className={styles.inspectorAside}>
        <span className={styles.inspectorKicker}>
          {t('comparison.chains.inspectorTitle')}
        </span>

        {selectedItem.type === 'amb' ? (
          <div className={styles.ambiguityCard}>
            <h3 className={styles.ambiguityTitle}>{selectedItem.name}</h3>
            <span className={styles.ambiguityBadge}>
              {t('comparison.chains.ambiguityTitle', {
                code: selectedItem.code ?? 'AMB-0091',
              })}
            </span>
            <p className={styles.ambiguityText}>
              {t('comparison.chains.ambiguityBody', { name: selectedItem.name })}
            </p>
            {ambCandidates.map((cand, idx) => (
              <button
                key={idx}
                type="button"
                className={styles.ambOptionBtn}
                onClick={() =>
                  setSelectedItem({
                    type: 'person',
                    name: cand.name,
                    sub: cand.sub,
                    code: 'NAR-000077',
                  })
                }
              >
                <span className={styles.ambOptionName}>{cand.name}</span>
                <span className={styles.ambOptionSub}>{cand.sub}</span>
              </button>
            ))}
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {t('comparison.chains.ambiguityNote')}
            </span>
          </div>
        ) : (
          <div className={styles.personCard}>
            <h3 className={styles.personName}>{selectedItem.name}</h3>
            <span className={styles.personId}>
              {selectedItem.code ?? t('comparison.chains.identityRecord')}
            </span>
            <span className={styles.personSub}>{selectedItem.sub}</span>
            <button
              type="button"
              className={styles.chip}
              style={{
                alignSelf: 'flex-start',
                background: 'var(--surface-white)',
                color: 'var(--ink)',
                border: '1px solid var(--rule-strong)',
              }}
              onClick={() => onOpenDossier(selectedItem.name)}
            >
              {t('comparison.chains.openDossier')}
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}
