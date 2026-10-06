import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getHadith } from '@/api/corpus'
import type { CorpusNarrator } from '@/api/schemas/corpus'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import styles from './Evidence.module.css'
import { qk } from '@/api/queryKeys'

type Tab = 'chain' | 'narrators' | 'judgments'

/** Chain, narrators and judgments of the report behind a piece of evidence, read from the corpus record. */
export function CorpusTabs({ hadithId }: { hadithId: number | null }) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const [tab, setTab] = useState<Tab>('chain')

  const hadith = useQuery({
    queryKey: qk.corpus.hadith(hadithId ?? 0),
    queryFn: ({ signal }) => getHadith(hadithId!, signal),
    enabled: hadithId !== null,
  })

  if (hadithId === null) {
    return <p className={styles.unavailableNote}>{t('evidence.tabs.noCorpus')}</p>
  }

  const references = hadith.data?.references ?? []
  const chains = references.flatMap((r) =>
    (r.sanads ?? []).map((s) => ({ book: r.book?.title ?? '', sanad: s })),
  )
  const narrators = new Map<number, CorpusNarrator>()
  for (const { sanad } of chains) {
    for (const node of sanad.narrator_nodes ?? []) {
      if (node.narrator) narrators.set(node.narrator.id, node.narrator)
    }
  }

  return (
    <section aria-label={t('evidence.tabs.label')}>
      <div role="tablist" className={styles.tabs}>
        {(['chain', 'narrators', 'judgments'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={[styles.tab, tab === k ? styles.tabOn : ''].join(' ')}
            onClick={() => setTab(k)}
          >
            {t(`evidence.tabs.${k}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" className={styles.tabPanel}>
        {hadith.isPending ? <p role="status">{t('states.loading.label')}</p> : null}
        {hadith.isError ? <p role="alert">{t('evidence.tabs.loadFailed')}</p> : null}

        {hadith.data && tab === 'chain' ? (
          chains.length === 0 ? (
            <NeutralState kind="unknown">{t('evidence.tabs.noChain')}</NeutralState>
          ) : (
            chains.map(({ book, sanad }, i) => {
              const nodes = (sanad.narrator_nodes ?? []).filter((x) => x.narrator)
              return (
                <div key={sanad.id} className={styles.chain}>
                  <p className={styles.hint}>
                    {t('evidence.tabs.chainOf', { n: n(i + 1), total: n(chains.length), count: n(nodes.length) })}
                    {book ? (
                      <>
                        {' · '}
                        <BidiText>{book}</BidiText>
                      </>
                    ) : null}
                  </p>
                  {nodes.length === 0 ? (
                    <NeutralState kind="unknown">{t('evidence.tabs.noNarrators')}</NeutralState>
                  ) : (
                    <ol className={styles.chainList}>
                      {nodes.map((node) => (
                        <li key={node.id}>
                          <BidiText>{node.narrator!.name}</BidiText>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )
            })
          )
        ) : null}

        {hadith.data && tab === 'narrators' ? (
          narrators.size === 0 ? (
            <NeutralState kind="unknown">{t('evidence.tabs.noNarrators')}</NeutralState>
          ) : (
            <ul className={styles.plainList}>
              {[...narrators.values()].map((nr) => (
                <li key={nr.id}>
                  <strong>
                    <BidiText>{nr.name}</BidiText>
                  </strong>
                  <span className={styles.hint}>
                    {nr.deathdate ? ` · ${t('evidence.tabs.narratorMeta', { death: nr.deathdate })}` : ''}
                    {nr.rutba_description ? ` · ${t('evidence.tabs.rutba', { value: nr.rutba_description })}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {hadith.data && tab === 'judgments' ? (
          references.filter((r) => r.hukm).length === 0 ? (
            <NeutralState kind="unknown">{t('evidence.tabs.noJudgments')}</NeutralState>
          ) : (
            <ul className={styles.plainList}>
              {references
                .filter((r) => r.hukm)
                .map((r) => (
                  <li key={r.id}>
                    {r.book?.title ? (
                      <BidiText>{r.book.title}</BidiText>
                    ) : null}
                    {' · '}
                    {t('evidence.tabs.hukm', { label: r.hukm!.label ?? r.hukm!.name })}
                  </li>
                ))}
            </ul>
          )
        ) : null}
      </div>
    </section>
  )
}
