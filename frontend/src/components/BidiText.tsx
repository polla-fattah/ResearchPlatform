import type { ElementType, HTMLAttributes } from 'react'
import { detectDirection } from './direction'

interface Props extends Omit<HTMLAttributes<HTMLElement>, 'dir' | 'children'> {
  children: string
  /** Force a direction (the editor's per-block RTL/LTR toggle). Default: detect from the text. */
  dir?: 'ltr' | 'rtl'
  /** Language of the text, e.g. 'ar' or 'ckb'; adds `lang` for screen readers and font choice. */
  lang?: string
  as?: ElementType
}

/**
 * Renders source or user text with its own direction, isolated from the surrounding UI direction,
 * so Arabic and Sorani wording is never reordered by an LTR (or RTL) interface.
 * Original wording is shown exactly as given: no trimming of diacritics, no normalisation.
 */
export function BidiText({ children, dir, lang, as: Tag = 'span', style, ...rest }: Props) {
  const resolved = dir ?? detectDirection(children)
  const arabic = resolved === 'rtl'
  return (
    <Tag
      dir={resolved ?? 'auto'}
      lang={lang}
      style={{
        unicodeBidi: 'isolate',
        ...(arabic ? { fontFamily: 'var(--font-arabic)' } : {}),
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
