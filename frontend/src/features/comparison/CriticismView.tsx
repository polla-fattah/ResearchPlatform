import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getNarrator } from '@/api/corpus'
import { qk } from '@/api/queryKeys'
import type { CorpusNarrator } from '@/api/schemas/corpus'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { CriticismMatrixTable } from './CriticismMatrixTable'
import { MAX_NARRATORS, narratorCode } from './comparisonModel'
import { NarratorPicker } from './NarratorPicker'
import { NarratorStatements } from './NarratorStatements'
import { SaveAnalysis } from './SaveAnalysis'
import { useCriticismMatrix } from './useComparison'
import styles from './Comparison.module.css'

interface Props {
  projectId: number
  narratorIds: number[]
  canEdit: boolean
  onChange: (ids: number[]) => void
}

/** Screen 10, Criticism: what critics said about the chosen narrators, in their exact words, and who said what. */
export function CriticismView({ projectId, narratorIds, canEdit, onChange }: Props) {
  const { t } = useTranslation()
  const matrix = useCriticismMatrix(projectId, narratorIds)

  const picker = (
    <NarratorPicker
      exclude={narratorIds}
      onPick={(n: CorpusNarrator) => narratorIds.length < MAX_NARRATORS && onChange([...narratorIds, n.id])}
    />
  )

  if (narratorIds.length === 0) {
    return (
      <div className={styles.empty}>
        <h2>{t('comparison.empty.crit.title')}</h2>
        <p>{t('comparison.empty.crit.body')}</p>
        {picker}
      </div>
    )
  }

  return (
    <section aria-label={t('comparison.views.crit')}>
      <ul className={styles.chips} aria-label={t('comparison.crit.chosen')}>
        {narratorIds.map((id) => (
          <Chip key={id} id={id} onRemove={() => onChange(narratorIds.filter((x) => x !== id))} />
        ))}
      </ul>
      {narratorIds.length < MAX_NARRATORS ? picker : <p className={styles.hint}>{t('comparison.crit.max', { count: MAX_NARRATORS })}</p>}

      <StateBoundary state={viewStateOf(matrix)} errorValue={matrix.error} onRetry={() => void matrix.refetch()}>
        {matrix.data ? (
          <>
            {canEdit ? <SaveAnalysis projectId={projectId} inputs={{ kind: 'criticism', narratorIds }} /> : null}
            <CriticismMatrixTable result={matrix.data} />
          </>
        ) : null}
      </StateBoundary>

      {narratorIds.map((id) => (
        <NarratorStatements key={id} narratorId={id} />
      ))}
    </section>
  )
}

function Chip({ id, onRemove }: { id: number; onRemove: () => void }) {
  const { t } = useTranslation()
  const narrator = useQuery({
    queryKey: qk.corpus.narrator(id),
    queryFn: ({ signal }) => getNarrator(id, signal),
  })
  const name = narrator.data?.name ?? narratorCode(id)
  return (
    <li className={styles.chip}>
      <BidiText>{name}</BidiText>
      <Button variant="ghost" onClick={onRemove} aria-label={t('comparison.crit.remove', { name })}>
        ×
      </Button>
    </li>
  )
}
