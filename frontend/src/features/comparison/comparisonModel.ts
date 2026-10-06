export type ComparisonViewMode = 'occ' | 'chains' | 'dossier' | 'crit'

export interface TextSegment {
  t: string
  diff?: boolean
  note?: boolean
}

export interface OccurrenceNote {
  vis: string
  text: string
}

export interface OccurrenceColumn {
  id: number | string
  book: string
  loc: string
  ev: string
  limited?: boolean
  hasText: boolean
  segs: TextSegment[]
  notes: OccurrenceNote[]
}

export interface ChainLink {
  name: string
  sub: string
  formula: string
  amb?: boolean
  ambCode?: string
  unknown?: boolean
  uncertain?: boolean
}

export interface ChainColumn {
  book: string
  id: string
  n: string
  links: ChainLink[]
}

export interface AmbiguityCandidate {
  name: string
  sub: string
}

export interface IdentityRow {
  k: string
  v: string
  flag?: string
}

export interface CriticismRow {
  critic: string
  died: string
  qawl: string
  src: string
  label: string
  dashed?: boolean
}

export interface SavedAnalysisInfo {
  name: string
  id: string
  meta: string
  version: number
  rerunLabel: string
  changed: boolean
}

export const DEFAULT_OCC_COLUMNS: OccurrenceColumn[] = [
  {
    id: 'occ-1',
    book: 'Sunan Abī Dāwūd · 106',
    loc: 'ed. al-Arnaʾūṭ 2009 · vol. 1, p. 78 · corpus v2026.08',
    ev: 'EV-0004',
    limited: false,
    hasText: true,
    segs: [
      { t: 'أَنَّ النَّبِيَّ صلى الله عليه وسلم ', diff: false, note: false },
      { t: 'تَوَضَّأَ ', diff: false, note: false },
      { t: 'ثَلاَثًا ثَلاَثًا', diff: false, note: true },
    ],
    notes: [{ vis: 'Project', text: 'Shortest form. Only the “three times” wording.' }],
  },
  {
    id: 'occ-2',
    book: 'Sunan al-Tirmidhī · 44',
    loc: 'ed. Shākir · vol. 1, p. 63 · corpus v2026.08',
    ev: 'EV-0007',
    limited: false,
    hasText: true,
    segs: [
      { t: 'تَوَضَّأَ النَّبِيُّ صلى الله عليه وسلم ', diff: false, note: false },
      { t: 'مَرَّةً مَرَّةً، وَمَرَّتَيْنِ مَرَّتَيْنِ، ', diff: true, note: false },
      { t: 'وَ', diff: true, note: false },
      { t: 'ثَلاَثًا ثَلاَثًا', diff: false, note: true },
    ],
    notes: [{ vis: '🔒 Private', text: 'Adds once and twice. A later expansion?' }],
  },
  {
    id: 'occ-3',
    book: 'Sunan al-Nasāʾī · 84',
    loc: 'ed. Abū Ghudda · vol. 1, p. Unknown · corpus v2026.08',
    ev: 'EV-0040',
    limited: false,
    hasText: true,
    segs: [
      { t: 'تَوَضَّأَ ', diff: false, note: false },
      { t: 'ثَلاَثًا ثَلاَثًا', diff: false, note: true },
    ],
    notes: [],
  },
]

export const DEFAULT_CHAINS: ChainColumn[] = [
  {
    book: 'Abū Dāwūd 106',
    id: 'CH-ABD-000106-1',
    n: '6 narrators',
    links: [
      { name: 'Abū Dāwūd', sub: 'compiler', formula: '' },
      { name: 'Musaddad', sub: 'NAR-002201', formula: 'حدثنا' },
      { name: 'Abū ʿAwāna', sub: 'NAR-000918', formula: 'حدثنا' },
      { name: 'Khālid ibn ʿAlqama', sub: 'NAR-003310', formula: 'عن' },
      { name: 'ʿAbd Khayr', sub: 'NAR-004102', formula: 'عن' },
      { name: 'ʿAlī ibn Abī Ṭālib', sub: 'Companion', formula: 'عن' },
    ],
  },
  {
    book: 'al-Tirmidhī 44',
    id: 'CH-TIR-000044-1',
    n: '6 narrators · 1 uncertain',
    links: [
      { name: 'al-Tirmidhī', sub: 'compiler', formula: '' },
      { name: 'Hannād', sub: 'NAR-002877', formula: 'حدثنا' },
      { name: 'Wakīʿ', sub: 'NAR-001544', formula: 'حدثنا' },
      { name: 'Sufyān', sub: 'Ambiguous: 2 candidates', formula: 'عن', amb: true, ambCode: 'AMB-0091' },
      { name: 'Abū Isḥāq al-Sabīʿī', sub: 'NAR-000512', formula: 'عن', uncertain: true },
      { name: 'ʿAlī ibn Abī Ṭālib', sub: 'Companion', formula: 'عن' },
    ],
  },
  {
    book: 'al-Nasāʾī 84',
    id: 'CH-NAS-000084-1',
    n: '5 narrators · 1 unknown',
    links: [
      { name: 'al-Nasāʾī', sub: 'compiler', formula: '' },
      { name: 'Qutayba', sub: 'NAR-001022', formula: 'أخبرنا' },
      { name: 'Abū ʿAwāna', sub: 'NAR-000918', formula: 'عن' },
      { name: 'Narrator not identified', sub: 'Unknown: name not recorded in this edition', formula: 'عن', unknown: true },
      { name: 'ʿAlī ibn Abī Ṭālib', sub: 'Companion', formula: 'عن' },
    ],
  },
]

export const DEFAULT_AMB_CANDIDATES: AmbiguityCandidate[] = [
  { name: 'Sufyān al-Thawrī', sub: 'NAR-000077 · d. 161 AH · Kufan' },
  { name: 'Sufyān ibn ʿUyayna', sub: 'NAR-000078 · d. 198 AH · Meccan' },
]

export const DEFAULT_IDENTITY: IdentityRow[] = [
  { k: 'Name', v: 'ʿAmr ibn ʿAbd Allāh al-Hamdānī' },
  { k: 'Kunya', v: 'Abū Isḥāq' },
  { k: 'Nisba', v: 'al-Sabīʿī, al-Kūfī' },
  { k: 'Death', v: '127, 128 or 129 AH (sources differ)', flag: 'Uncertain' },
  { k: 'Birth', v: 'Unknown', flag: 'Unknown' },
  { k: 'Generation', v: '3rd (Taqrīb classification)' },
]

export const DEFAULT_CRITICISM: CriticismRow[] = [
  { critic: 'Ibn Ḥajar', died: 'd. 852 AH', qawl: 'ثقة مكثر عابد، اختلط بأخرة', src: 'Taqrīb al-Tahdhīb · no. 5065', label: 'Reliable + late ikhtilāṭ' },
  { critic: 'al-ʿIjlī', died: 'd. 261 AH', qawl: 'كوفي تابعي ثقة', src: 'al-Thiqāt · p. 366', label: 'Reliable' },
  { critic: 'Abū Ḥātim', died: 'd. 277 AH', qawl: 'ثقة', src: 'al-Jarḥ wa-l-taʿdīl · vol. 6, p. 243', label: 'Reliable' },
  { critic: 'Ibn Ḥajar', died: 'd. 852 AH', qawl: 'مشهور بالتدليس', src: 'Ṭabaqāt al-mudallisīn · no. 91', label: 'Tadlīs' },
  { critic: 'Ibn Maʿīn', died: 'd. 233 AH', qawl: '—', src: 'No statement recorded in the corpus', label: 'Unknown', dashed: true },
]
