import { expect, test } from '@playwright/test'
import { axeViolations, blocking } from './support/a11y'
import { installApi } from './support/mockApi'
import { VISITS } from './screens'

// Accessibility of every visited screen in English (left to right). Serious and critical problems fail the test; the
// rest are printed so they can be worked through.
for (const v of VISITS) {
  test(`a11y ${v.name}`, async ({ page }) => {
    const warnings: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'warning' && m.text().includes('[contract]')) warnings.push(m.text().slice(0, 200))
    })
    await installApi(page, { signedIn: v.signedIn })
    await page.goto(v.path)
    await expect(page.getByText(v.ready).first()).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState('networkidle')
    const violations = await axeViolations(page)
    const bad = blocking(violations)
    if (violations.length) console.log(`[${v.name}] ${violations.map((x) => `${x.impact}:${x.id}(${x.count})`).join(', ')}`)
    if (warnings.length) console.log(`[${v.name}] contract warnings: ${warnings.length}\n  ${warnings.slice(0, 3).join('\n  ')}`)
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([])
  })
}
