import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import styles from './Members.module.css'

/**
 * A link in a read-only field with a button that copies it. Copying can be refused by the browser; then the field is
 * still selectable, so the person can copy by hand. "Copied" is only said when the browser accepted it.
 */
export function CopyLink({ link }: { link: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <div className={styles.link}>
      <input readOnly dir="ltr" value={link} aria-label={t('members.link.label')} onFocus={(e) => e.currentTarget.select()} />
      <Button
        onClick={() => {
          navigator.clipboard?.writeText(link).then(() => setCopied(true), () => undefined)
        }}
      >
        {copied ? t('members.link.copied') : t('members.link.copy')}
      </Button>
    </div>
  )
}
