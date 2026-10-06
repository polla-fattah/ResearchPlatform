/** First strong character decides direction: Arabic-script ranges are RTL, Latin is LTR. */
const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/
const LTR_CHAR = /[A-Za-zÀ-ɏ]/

export function detectDirection(text: string): 'ltr' | 'rtl' | undefined {
  for (const ch of text) {
    if (RTL_CHAR.test(ch)) return 'rtl'
    if (LTR_CHAR.test(ch)) return 'ltr'
  }
  return undefined
}
