import { useTranslation } from 'react-i18next'
import type { CorpusOccurrence, CorpusSearchHit } from '@/api/schemas/corpus'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { detectDirection } from '@/components/direction'
import { formatCode } from '@/domain/codes'
import { pickableFromOccurrence } from '@/domain/pickable'
import { chainLine, occKey, segments, WHY_KEYS } from './searchModel'
import styles from './Search.module.css'

interface Props {
  hits: CorpusSearchHit[]
  selected: ReadonlySet<string>
  /** `${resource_type}:${corpus_id}` of occurrences already in the project's resources. */
  inResources: ReadonlySet<string>
  canSelect: boolean
  onToggle: (key: string) => void
  onToggleGroup: (keys: string[], on: boolean) => void
}

/** The original wording with the matched part marked. Offsets come from the API; the text is unchanged. */
function Highlighted({ text, highlights }: { text: string; highlights: CorpusSearchHit['highlights'] }) {
  const dir = detectDirection(text) ?? 'auto'
  return (
    <p className={styles.matn} dir={dir} lang={dir === 'rtl' ? 'ar' : undefined}>
      {segments(text, highlights).map((s, i) =>
        s.hit ? (
          <mark key={i} className={styles.mark}>
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </p>
  )
}

function Occurrence({
  hit,
  occ,
  checked,
  already,
  canSelect,
  onToggle,
}: {
  hit: CorpusSearchHit
  occ: CorpusOccurrence
  checked: boolean
  already: boolean
  canSelect: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const p = pickableFromOccurrence(hit, occ)
  const chain = chainLine(occ.chain_summary)
  const volume = occ.volume ?? null
  const page = occ.page_number ?? null

  return (
    <li className={styles.occ}>
      {canSelect ? (
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={t('search.results.selectOne', { title: p.title })}
        />
      ) : null}
      <div className={styles.occBody}>
        <div className={styles.occHead}>
          <span className={styles.kicker}>{t('search.results.occurrence')}</span>
          <strong>
            <BidiText>{occ.book?.title ?? p.code}</BidiText>
          </strong>
          <span className="mono">{p.code}</span>
        </div>
        <div className={styles.occLoc}>
          {[
            volume !== null ? t('search.results.volume', { volume }) : null,
            page !== null ? t('search.results.page', { page }) : t('search.results.pageUnknown'),
            occ.hadith_number != null ? t('search.results.source', { number: occ.hadith_number }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          {occ.chapter?.title ? (
            <>
              {' · '}
              <BidiText>{occ.chapter.title}</BidiText>
            </>
          ) : null}
        </div>
        <div className={styles.occMeta}>
          {chain ? (
            <span>
              {t('search.results.chain')}:{' '}
              {t('search.results.chainNarrators', { count: chain.count, formattedCount: chain.count })}
              {chain.names.length > 0 ? (
                <>
                  {' · '}
                  <BidiText>{chain.names.join(' → ')}</BidiText>
                </>
              ) : null}
              {chain.uncertain ? <NeutralState kind="uncertainOrder" /> : null}
            </span>
          ) : (
            <NeutralState kind="unknown">{t('search.results.noChain')}</NeutralState>
          )}
          {occ.hukm ? (
            <span>
              {t('search.results.hukm', { label: occ.hukm.label ?? occ.hukm.name })}
            </span>
          ) : (
            <NeutralState kind="unknown">{t('search.results.hukmUnknown')}</NeutralState>
          )}
          {already ? <span className={styles.already}>✓ {t('search.results.inResources')}</span> : null}
          {p.gaps.length > 0 ? <NeutralState kind="incompleteCitation" /> : null}
        </div>
      </div>
    </li>
  )
}

export function ResultList({ hits, selected, inResources, canSelect, onToggle, onToggleGroup }: Props) {
  const { t } = useTranslation()
  return (
    <ul className={styles.groups}>
      {hits.map((hit) => {
        const occs = hit.occurrences ?? []
        const keys = occs.map((o) => occKey(o.id))
        const allOn = keys.length > 0 && keys.every((k) => selected.has(k))
        const why = WHY_KEYS[hit.why ?? hit.matched_mode ?? ''] ?? 'unknown'
        const code = formatCode('REP', hit.id)
        return (
          <li key={hit.id} className={styles.group}>
            <header className={styles.groupHead}>
              <div>
                <span className={styles.kicker}>{t('search.results.report', { code })}</span>
              </div>
              {canSelect && keys.length > 0 ? (
                <label className={styles.groupSelect}>
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={(e) => onToggleGroup(keys, e.target.checked)}
                    aria-label={t('search.results.selectGroup', { code })}
                  />
                </label>
              ) : null}
            </header>
            {hit.matn ? <Highlighted text={hit.matn} highlights={hit.highlights} /> : null}
            <p className={styles.why}>
              <strong>{t('search.results.why')}:</strong> {t(`search.results.whyValue.${why}`)}
            </p>
            {occs.length > 0 ? (
              <ul className={styles.occs}>
                {occs.map((o) => (
                  <Occurrence
                    key={o.id}
                    hit={hit}
                    occ={o}
                    checked={selected.has(occKey(o.id))}
                    already={inResources.has(`hadith_reference:${o.id}`)}
                    canSelect={canSelect}
                    onToggle={() => onToggle(occKey(o.id))}
                  />
                ))}
              </ul>
            ) : (
              <p className={styles.hint}>{t('search.results.noOccurrences')}</p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
