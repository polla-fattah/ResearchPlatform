import MarkdownIt from 'markdown-it'
import { extractCitations } from './writingModel'

/**
 * Renders the researcher's Markdown for the preview.
 *  - Raw HTML in the text is not rendered (it is escaped), links to `javascript:` and the like are dropped, and
 *    images are off: the text comes from collaborators and is shown to others.
 *  - Every block gets `dir="auto"`, so Arabic, Sorani and English paragraphs each run in their own direction.
 *  - `[@EV-0004 exact]` becomes a numbered marker, numbered by first appearance (the same numbers as the citation list).
 */
const md = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: false })
md.disable('image')

md.inline.ruler.before('link', 'citation', (state, silent) => {
  const src = state.src
  if (src.charCodeAt(state.pos) !== 0x5b /* [ */ || src.charCodeAt(state.pos + 1) !== 0x40 /* @ */) return false
  const match = /^\[@(EV-\d+)(?:\s+(exact|paraphrase|ref))?\]/.exec(src.slice(state.pos))
  if (!match) return false
  if (!silent) {
    const token = state.push('citation', '', 0)
    token.meta = { code: match[1], kind: match[2] ?? 'ref' }
  }
  state.pos += match[0].length
  return true
})

md.renderer.rules.citation = (tokens, idx, _options, env: unknown) => {
  const meta = tokens[idx]!.meta as { code: string; kind: string }
  const n = (env as { numbers?: Map<string, number> } | undefined)?.numbers?.get(meta.code)
  const code = md.utils.escapeHtml(meta.code)
  return `<sup class="cite" data-evidence="${code}" data-kind="${md.utils.escapeHtml(meta.kind)}">[${n ?? '?'}]</sup>`
}

const BLOCKS = new Set(['paragraph_open', 'heading_open', 'blockquote_open', 'list_item_open', 'th_open', 'td_open'])
md.core.ruler.push('block_direction', (state) => {
  for (const token of state.tokens) if (BLOCKS.has(token.type)) token.attrSet('dir', 'auto')
  return true
})

// Where a document sits inside a page that has its own headings (a publication, a package under review), its headings are
// pushed down by `headingOffset` levels so the page's outline stays in order: a "#" in the text is never a second <h1>.
md.core.ruler.push('heading_offset', (state) => {
  const offset = Number((state.env as { headingOffset?: number }).headingOffset ?? 0)
  if (!offset) return true
  for (const token of state.tokens) {
    if (token.type === 'heading_open' || token.type === 'heading_close') {
      token.tag = `h${Math.min(6, Number(token.tag.slice(1)) + offset)}`
    }
  }
  return true
})

/** HTML for the preview. Safe to insert: see above. `headingOffset` pushes the text's headings down that many levels. */
export function renderMarkdown(text: string, options: { headingOffset?: number } = {}): string {
  const numbers = new Map(extractCitations(text).map((c) => [c.code, c.number]))
  return md.render(text, { numbers, headingOffset: options.headingOffset ?? 0 })
}
