import type { Pickable } from '@/domain/pickable'

export type ExcerptMode = 'item' | 'span' | 'page'

export interface PickerSelection {
  item: Pickable | null
  mode: ExcerptMode
  /** Text the researcher selected in the source panel. */
  span: string
  /** A page range such as "78–79". */
  pages: string
}

export const emptySelection: PickerSelection = { item: null, mode: 'item', span: '', pages: '' }
