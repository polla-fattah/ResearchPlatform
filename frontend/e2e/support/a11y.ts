import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

/** What axe reports for the page as it stands, limited to the WCAG 2.1 A and AA rules and best practices. */
export async function axeViolations(p: Page) {
  const result = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze()
  return result.violations.map((v) => ({ id: v.id, impact: v.impact ?? 'minor', help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')), count: v.nodes.length }))
}

export const blocking = (violations: Awaited<ReturnType<typeof axeViolations>>) => violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
