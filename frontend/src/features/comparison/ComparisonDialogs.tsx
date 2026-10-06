import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'

interface SelectInputsModalProps {
  onClose: () => void
  onApply: (selectedIds: string[]) => void
}

const AVAILABLE_INPUTS = [
  { id: 'occ-1', label: 'Sunan Abī Dāwūd · 106 (EV-0004)' },
  { id: 'occ-2', label: 'Sunan al-Tirmidhī · 44 (EV-0007)' },
  { id: 'occ-3', label: 'Sunan al-Nasāʾī · 84 (EV-0040)' },
  { id: 'occ-4', label: 'Ṣaḥīḥ Muslim · 226 (EV-0041)' },
  { id: 'occ-5', label: 'Sunan Ibn Mājah · 450 (EV-0042)' },
]

export function SelectInputsModal({ onClose, onApply }: SelectInputsModalProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<string[]>(['occ-1', 'occ-2', 'occ-3'])

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      if (selected.length > 2) {
        setSelected(selected.filter((x) => x !== id))
      }
    } else {
      if (selected.length < 6) {
        setSelected([...selected, id])
      }
    }
  }

  return (
    <Modal onClose={onClose} title={t('comparison.dialog.selectTitle')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink-2)' }}>
          {t('comparison.dialog.selectPrompt')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {AVAILABLE_INPUTS.map((inp) => {
            const checked = selected.includes(inp.id)
            return (
              <label
                key={inp.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px',
                  background: checked ? 'var(--accent-soft)' : 'var(--surface)',
                  border: '1px solid var(--rule)',
                  borderRadius: '2px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(inp.id)}
                />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{inp.label}</span>
              </label>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <Button variant="secondary" onClick={onClose}>
            {t('comparison.dialog.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onApply(selected)
              onClose()
            }}
          >
            {t('comparison.dialog.apply')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

interface AnnotateModalProps {
  colId?: number | string
  onClose: () => void
  onSave: (text: string) => void
}

export function AnnotateModal({ onClose, onSave }: AnnotateModalProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')

  return (
    <Modal onClose={onClose} title={t('comparison.dialog.annotateTitle')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('comparison.dialog.notePlaceholder')}
          style={{
            padding: '8px',
            border: '1px solid var(--rule-strong)',
            font: 'inherit',
            fontSize: '13px',
            borderRadius: '2px',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button variant="secondary" onClick={onClose}>
            {t('comparison.dialog.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!text.trim()}
            onClick={() => {
              onSave(text.trim())
              setText('')
              onClose()
            }}
          >
            {t('comparison.dialog.saveNote')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
