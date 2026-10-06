import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NeutralState, ProvenanceTag, VisibilityBadge } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { CountedUnit } from '@/components/CountedUnit'
import { StateBoundary } from '@/components/StateBoundary'
import type { ViewState } from '@/components/viewState'
import { EVIDENCE_STATES, VISIBILITIES } from '@/domain/vocab'
import { usePreferences } from '@/app/preferencesContext'

const STATES: ViewState[] = ['normal', 'empty', 'loading', 'error', 'forbidden', 'conflict']

/** Development-only page (route /dev/kit): the primitives and the six states, like the mockups' review bar. */
export function ComponentKit() {
  const { t } = useTranslation()
  const { prefs, setPrefs, date } = usePreferences()
  const [state, setState] = useState<ViewState>('normal')
  const [confirming, setConfirming] = useState(false)

  return (
    <section>
      <h1>{t('shell.devKit')}</h1>

      <h2>Six states</h2>
      <p>
        {STATES.map((s) => (
          <Button key={s} variant={s === state ? 'primary' : 'secondary'} onClick={() => setState(s)}>
            {s}
          </Button>
        ))}
      </p>
      <StateBoundary state={state} onRetry={() => setState('normal')}>
        <p>Normal content.</p>
      </StateBoundary>

      <h2>Provenance and visibility</h2>
      <p style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <ProvenanceTag kind="source" />
        <ProvenanceTag kind="note" />
        <ProvenanceTag kind="attributed" name="al-Tirmidhī" />
        <ProvenanceTag kind="suggestion" />
        {VISIBILITIES.map((v) => (
          <VisibilityBadge key={v} visibility={v} />
        ))}
      </p>
      <p style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <NeutralState kind="unknown" />
        <NeutralState kind="incompleteCitation" />
        <NeutralState kind="partialRun" />
        <NeutralState kind="uncertainOrder" />
        {EVIDENCE_STATES.map((s) => (
          <NeutralState key={s} kind="limitation">
            {t(`evidenceState.${s}`)}
          </NeutralState>
        ))}
      </p>

      <h2>Source text keeps its own direction</h2>
      <p>
        <BidiText as="blockquote">أَنَّ النَّبِيَّ صلى الله عليه وسلم تَوَضَّأَ ثَلاَثًا ثَلاَثًا</BidiText>
        <BidiText lang="ckb">ئەم دەقە بنەمای بەراوردی دەربڕینەکانە.</BidiText>
      </p>

      <h2>Counts and dates</h2>
      <p>
        <CountedUnit count={42} unit="occurrence" /> · <CountedUnit count={1} unit="finding" />
      </p>
      <p>
        <label>
          Numerals{' '}
          <select
            value={prefs.numerals}
            onChange={(e) => setPrefs({ numerals: e.target.value as typeof prefs.numerals })}
          >
            <option value="western">Western (0123)</option>
            <option value="eastern_arabic">Eastern Arabic (٠١٢٣)</option>
          </select>
        </label>{' '}
        <label>
          Calendar{' '}
          <select
            value={prefs.calendar}
            onChange={(e) => setPrefs({ calendar: e.target.value as typeof prefs.calendar })}
          >
            <option value="gregorian_hijri">Gregorian with Hijri</option>
            <option value="hijri_gregorian">Hijri with Gregorian</option>
            <option value="gregorian">Gregorian only</option>
          </select>
        </label>
      </p>
      <p>{date('2026-10-04T08:30:00Z', { time: true })}</p>

      <h2>Safe action</h2>
      <Button variant="danger" onClick={() => setConfirming(true)}>
        Move to trash…
      </Button>
      <ConfirmAction
        open={confirming}
        danger
        title="Move this project to trash?"
        confirmLabel="Move to trash"
        onCancel={() => setConfirming(false)}
        onConfirm={() => setConfirming(false)}
      >
        <p>The project becomes read-only and is deleted permanently after 30 days.</p>
      </ConfirmAction>
    </section>
  )
}
