import { type FindingStatus } from '@/api/schemas/findings'

export type EditorViewMode = 'index' | 'editor' | 'finding' | 'versions' | 'cite' | 'member'
export type EditorLayoutMode = 'source' | 'split' | 'preview'
export type CitationKind = 'quote' | 'para'

export interface EditorBlock {
  id: string
  k: 'h' | 'p' | 'q' | 'list' | 'table'
  dir: 'ltr' | 'rtl'
  lang?: string
  md: string
  text: string
  cite?: string
  para?: boolean
  items?: string[]
  head?: string[]
  rows?: Array<{ a: string; b: string; c: string }>
}

export interface CitationFootnote {
  n: string
  text: string
  flag?: string
}

export interface VersionInfo {
  id: string
  versionNumber: number
  when: string
  note: string
  isCurrent?: boolean
  isSelectedForCompare?: boolean
  content: string
}

export interface MockDocument {
  id: number
  title: string
  meta: string
  links: string
  content: string
  versionNumber: number
  lastSavedText: string
  findingsCount: number
  citationsCount: number
}

export interface MockFinding {
  id: number
  code: string
  title: string
  question?: string
  claim: string
  reasoning: string
  limitations?: string
  meta: string
  status: FindingStatus
  bs: 'solid' | 'dashed'
  evidence: Array<{
    rel: 'Supporting' | 'Opposing' | 'Contextual' | 'Unresolved'
    count: string
    none: boolean
    bs: 'solid' | 'dashed'
    items: Array<{ t: string; id: string }>
  }>
  contributors: string[]
  usedInDocs: Array<{ title: string; section: string }>
}

export const INITIAL_BLOCKS: EditorBlock[] = [
  {
    id: 'b1',
    k: 'h',
    dir: 'ltr',
    md: '## 2. The wording of the Kufan reports',
    text: '2. The wording of the Kufan reports',
  },
  {
    id: 'b2',
    k: 'p',
    dir: 'ltr',
    md: 'The shortest form is preserved by Abū Dāwūd through Musaddad [@EV-0004].',
    text: 'The shortest form is preserved by Abū Dāwūd through Musaddad',
    cite: '1',
  },
  {
    id: 'b3',
    k: 'q',
    dir: 'rtl',
    lang: 'ar',
    md: '> «أَنَّ النَّبِيَّ صلى الله عليه وسلم تَوَضَّأَ ثَلاَثًا ثَلاَثًا» [@EV-0004 exact]',
    text: '«أَنَّ النَّبِيَّ صلى الله عليه وسلم تَوَضَّأَ ثَلاَثًا ثَلاَثًا»',
    cite: '1',
  },
  {
    id: 'b4',
    k: 'p',
    dir: 'rtl',
    lang: 'ckb',
    md: 'لە ڕیوایەتی تیرمیزیدا دەربڕینەکە فراوانترە و "یەک جار، دوو جار" ی تێدایە.',
    text: 'لە ڕیوایەتی تیرمیزیدا دەربڕینەکە فراوانترە و "یەک جار، دوو جار" ی تێدایە.',
  },
  {
    id: 'b5',
    k: 'p',
    dir: 'ltr',
    md: 'Al-Tirmidhī’s version adds the once and twice forms before the threefold one [@EV-0007 paraphrase].',
    text: 'Al-Tirmidhī’s version adds the once and twice forms before the threefold one',
    cite: '2',
    para: true,
  },
  {
    id: 'b6',
    k: 'list',
    dir: 'ltr',
    md: '- 11 of 14 occurrences: “three times” only\n- 3 of 14: expanded form, all via Wakīʿ\n- 1 occurrence: wording not recorded',
    text: 'Occurrences breakdown',
    items: [
      '11 of 14 occurrences: “three times” only',
      '3 of 14: expanded form, all via Wakīʿ',
      '1 occurrence: wording not recorded (limitation notice)',
    ],
  },
  {
    id: 'b7',
    k: 'table',
    dir: 'ltr',
    md: '| Book | Wording | Route |\n|---|---|---|\n| Abū Dāwūd 106 | ثلاثا ثلاثا | Musaddad |\n| al-Tirmidhī 44 | مرة مرة … ثلاثا | Wakīʿ |\n| al-Nasāʾī 84 [@EV-0040] | ثلاثا ثلاثا | Qutayba |',
    text: 'Occurrences Table',
    head: ['Book', 'Wording', 'Route'],
    rows: [
      { a: 'Abū Dāwūd 106', b: 'ثلاثا ثلاثا', c: 'Musaddad' },
      { a: 'al-Tirmidhī 44', b: 'مرة مرة … ثلاثا', c: 'Wakīʿ' },
      { a: 'al-Nasāʾī 84 [3]', b: 'ثلاثا ثلاثا', c: 'Qutayba' },
    ],
  },
]

export const INITIAL_NOTES: CitationFootnote[] = [
  {
    n: '1',
    text: 'Abū Dāwūd, al-Sunan, ed. al-Arnaʾūṭ (2009), 1:78, no. 106. Exact quotation.',
    flag: '',
  },
  {
    n: '2',
    text: 'al-Tirmidhī, al-Sunan, ed. Shākir, 1:63, no. 44. Paraphrase.',
    flag: '',
  },
  {
    n: '3',
    text: 'al-Nasāʾī, al-Sunan, ed. Abū Ghudda, 1:[page unknown], no. 84.',
    flag: 'Incomplete citation · page',
  },
]

export const INITIAL_DOCUMENTS: MockDocument[] = [
  {
    id: 1,
    title: 'Main article',
    meta: 'v15 · saved 11:42 today · Arabic, Sorani, English blocks',
    links: 'Uses 4 findings · 12 citations',
    content: INITIAL_BLOCKS.map((b) => b.md).join('\n\n'),
    versionNumber: 15,
    lastSavedText: 'Saved 11:42 · v15',
    findingsCount: 4,
    citationsCount: 12,
  },
  {
    id: 2,
    title: 'Chain summary',
    meta: 'v6 · saved 30 Sep',
    links: 'Uses 3 findings · 8 citations',
    content: '# Chain summary\n\nOverview of the isnād transmission lines.',
    versionNumber: 6,
    lastSavedText: 'Saved 30 Sep · v6',
    findingsCount: 3,
    citationsCount: 8,
  },
]

export const INITIAL_FINDINGS: MockFinding[] = [
  {
    id: 1,
    code: 'F-01',
    title: 'F-01 · Scope: 14 occurrences across 6 Sunan books',
    claim: 'The reporting covers 14 occurrences across the canonical Sunan collections.',
    reasoning: 'Verified against Abu Dawud, al-Tirmidhi, al-Nasa’i, and Ibn Majah.',
    limitations: 'Limited to the six early Sunan books.',
    meta: '5 supporting · in 2 documents',
    status: 'supported',
    bs: 'solid',
    evidence: [
      {
        rel: 'Supporting',
        count: '5 evidence items',
        bs: 'solid',
        none: false,
        items: [
          { t: 'Abū Dāwūd 106 · short form', id: 'EV-0004' },
          { t: 'al-Tirmidhī 44 · expanded wording', id: 'EV-0007' },
        ],
      },
      { rel: 'Opposing', count: '0 evidence items', bs: 'solid', none: true, items: [] },
      { rel: 'Contextual', count: '0 evidence items', bs: 'solid', none: true, items: [] },
      { rel: 'Unresolved', count: '0 evidence items', bs: 'dashed', none: true, items: [] },
    ],
    contributors: ['Shilan Rashid · author'],
    usedInDocs: [{ title: 'Main article', section: '§1' }],
  },
  {
    id: 2,
    code: 'F-02',
    title: 'F-02 · The Kufan chains share Abū ʿAwāna as a common link',
    claim: 'Abū ʿAwāna functions as the principal transmitter for the Kufan lines.',
    reasoning: 'Isnād convergence analysis points directly to Abū ʿAwāna.',
    limitations: '',
    meta: '4 supporting · 1 opposing · in 1 document',
    status: 'provisional',
    bs: 'solid',
    evidence: [
      { rel: 'Supporting', count: '4 evidence items', bs: 'solid', none: false, items: [{ t: 'Musannaf Ibn Abi Shaybah 1820', id: 'EV-0012' }] },
      { rel: 'Opposing', count: '1 evidence item', bs: 'solid', none: false, items: [{ t: 'Tahdhib al-Kamal entry', id: 'EV-0015' }] },
      { rel: 'Contextual', count: '0 evidence items', bs: 'solid', none: true, items: [] },
      { rel: 'Unresolved', count: '0 evidence items', bs: 'dashed', none: true, items: [] },
    ],
    contributors: ['Shilan Rashid · author'],
    usedInDocs: [{ title: 'Main article', section: '§2' }],
  },
  {
    id: 3,
    code: 'F-03',
    title: 'F-03 · Abū Isḥāq’s late ikhtilāṭ affects the Tirmidhī route',
    claim: 'The late confusion of Abū Isḥāq warrants caution in attributing verbatim wording.',
    reasoning: 'Reported by Ibn Hajar and al-Dhahabi.',
    limitations: '',
    meta: '2 supporting · 1 unresolved',
    status: 'provisional',
    bs: 'solid',
    evidence: [
      { rel: 'Supporting', count: '2 evidence items', bs: 'solid', none: false, items: [{ t: 'Ibn Ḥajar on Abū Isḥāq', id: 'EV-0021' }] },
      { rel: 'Opposing', count: '0 evidence items', bs: 'solid', none: true, items: [] },
      { rel: 'Contextual', count: '0 evidence items', bs: 'solid', none: true, items: [] },
      { rel: 'Unresolved', count: '1 evidence item', bs: 'dashed', none: false, items: [{ t: 'Al-Tirmidhi sanad 44', id: 'EV-0007' }] },
    ],
    contributors: ['Shilan Rashid · author'],
    usedInDocs: [],
  },
  {
    id: 4,
    code: 'F-04',
    title: 'F-04 · Al-Tirmidhī’s wording is a later expansion',
    question: 'Is al-Tirmidhī’s “once, twice, three times” a later expansion of the Kufan wording?',
    claim: 'Probably yes: the expanded wording appears only on the Wakīʿ–Sufyān route, while the other routes have only “three times”.',
    reasoning: 'Of 14 occurrences, 11 carry only ثلاثا ثلاثا. The 3 with the expansion all pass through Wakīʿ. The identity of Sufyān on that route is unresolved (AMB-0091), which limits the conclusion.',
    limitations: '',
    meta: '3 supporting · 1 unresolved · in 2 documents',
    status: 'provisional',
    bs: 'solid',
    evidence: [
      {
        rel: 'Supporting',
        count: '3 evidence items',
        bs: 'solid',
        none: false,
        items: [
          { t: 'al-Tirmidhī 44 · expanded wording', id: 'EV-0007' },
          { t: 'Ibn Mājah 404 · expanded wording via Wakīʿ', id: 'EV-0018' },
          { t: 'Abū Dāwūd 106 · short form', id: 'EV-0004' },
        ],
      },
      { rel: 'Opposing', count: '0 evidence items', bs: 'solid', none: true, items: [] },
      {
        rel: 'Contextual',
        count: '1 evidence item',
        bs: 'solid',
        none: false,
        items: [{ t: 'Ibn Ḥajar on Abū Isḥāq · ikhtilāṭ', id: 'EV-0021' }],
      },
      {
        rel: 'Unresolved',
        count: '1 evidence item',
        bs: 'dashed',
        none: false,
        items: [{ t: 'Sufyān ambiguity on the Wakīʿ route', id: 'AMB-0091' }],
      },
    ],
    contributors: ['Shilan Rashid · author'],
    usedInDocs: [
      { title: 'Main article', section: '§2' },
      { title: 'Chain summary', section: 'table 1' },
    ],
  },
  {
    id: 5,
    code: 'F-05',
    title: 'F-05 · “Three times” is the earliest wording',
    claim: 'The threefold repetition without once/twice represents the primitive Kufan core.',
    reasoning: 'Supported by the majority of early transmitters.',
    limitations: 'Earliest written musannafat only.',
    meta: '1 contextual',
    status: 'provisional',
    bs: 'solid',
    evidence: [
      { rel: 'Supporting', count: '1 evidence item', bs: 'solid', none: false, items: [{ t: 'Musannaf Ibn Abi Shaybah', id: 'EV-0012' }] },
      { rel: 'Opposing', count: '0 evidence items', bs: 'solid', none: true, items: [] },
      { rel: 'Contextual', count: '1 evidence item', bs: 'solid', none: false, items: [{ t: 'Kufan historical context', id: 'EV-0025' }] },
      { rel: 'Unresolved', count: '0 evidence items', bs: 'dashed', none: true, items: [] },
    ],
    contributors: ['Shilan Rashid · author'],
    usedInDocs: [],
  },
  {
    id: 6,
    code: 'F-06',
    title: 'F-06 · Shuʿba is not the common link',
    claim: 'Transmission trees rule out Shuʿba as the single originator.',
    reasoning: 'Independent collateral lines exist from Sufyan.',
    limitations: 'Based on currently indexed books in corpus.',
    meta: '1 supporting · 1 opposing',
    status: 'inconclusive',
    bs: 'dashed',
    evidence: [
      { rel: 'Supporting', count: '1 evidence item', bs: 'solid', none: false, items: [{ t: 'Tahdhib al-Kamal Shu\'ba', id: 'EV-0030' }] },
      { rel: 'Opposing', count: '1 evidence item', bs: 'solid', none: false, items: [{ t: 'Al-Jarh wa al-Ta\'dil Shu\'ba', id: 'EV-0031' }] },
      { rel: 'Contextual', count: '0 evidence items', bs: 'solid', none: true, items: [] },
      { rel: 'Unresolved', count: '0 evidence items', bs: 'dashed', none: true, items: [] },
    ],
    contributors: ['Shilan Rashid · author'],
    usedInDocs: [],
  },
]

export const INITIAL_VERSIONS: VersionInfo[] = [
  {
    id: 'v15 · current',
    versionNumber: 15,
    when: 'Today 11:42',
    note: 'Shilan Rashid · laptop session',
    isCurrent: true,
    content:
      'Of 14 occurrences, 11 carry only the “three times” wording.\nThe identity of Sufyān on the Wakīʿ route is unresolved, which limits this conclusion.',
  },
  {
    id: 'v14',
    versionNumber: 14,
    when: 'Today 09:10',
    note: 'Shilan Rashid',
    content: 'Of 14 occurrences, 10 carry only the “three times” wording.',
  },
  {
    id: 'v13',
    versionNumber: 13,
    when: '2 Oct',
    note: 'Shilan Rashid · added Sorani paragraph',
    content: 'ئەم دەربڕینە کۆنترە.\nOf 14 occurrences, 10 carry only the “three times” wording.',
  },
  {
    id: 'v12',
    versionNumber: 12,
    when: '1 Oct',
    note: 'Shilan Rashid · selected for compare',
    isSelectedForCompare: true,
    content:
      'Of 14 occurrences, 10 carry only the “three times” wording.\nئەم دەربڕینە کۆنترە.',
  },
  {
    id: 'v11',
    versionNumber: 11,
    when: '30 Sep',
    note: 'Shilan Rashid',
    content: 'Initial comparison of Kufan wording.',
  },
  {
    id: 'v1–v10',
    versionNumber: 10,
    when: '18–29 Sep',
    note: '10 earlier versions',
    content: 'Earliest drafts.',
  },
]

/**
 * WRT-01 Public submission readiness check.
 * Reports missing required public-submission fields:
 * - Limitations field must not be empty
 * - At least one opposing or unresolved evidence item must be considered
 */
export function checkSubmissionReadiness(finding: MockFinding): {
  isReady: boolean
  missingFields: string[]
} {
  const missing: string[] = []
  if (!finding.limitations || finding.limitations.trim().length === 0) {
    missing.push('Limitations')
  }

  const hasOpposing = finding.evidence.some(
    (g) => g.rel === 'Opposing' && g.items.length > 0,
  )
  const hasUnresolved = finding.evidence.some(
    (g) => g.rel === 'Unresolved' && g.items.length > 0,
  )

  if (!hasOpposing && !hasUnresolved) {
    missing.push('Opposing or Unresolved evidence')
  }

  return {
    isReady: missing.length === 0,
    missingFields: missing,
  }
}
