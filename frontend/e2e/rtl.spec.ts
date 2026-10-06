import { expect, test } from '@playwright/test'
import { axeViolations, blocking } from './support/a11y'
import { installApi } from './support/mockApi'
import { VISITS } from './screens'

// Right-to-left layout: every screen in Sorani and Arabic. The interface strings of both are still English (they wait for
// specialist translation), so this checks the MIRRORING: direction, no sideways scrolling, the rail on the reading side,
// and the same accessibility rules. Screenshots go to e2e/screenshots for a look.
for (const language of ['ckb', 'ar'] as const) {
  for (const v of VISITS) {
    test(`rtl ${language} ${v.name}`, async ({ page }) => {
      await installApi(page, { signedIn: v.signedIn, language })
      await page.goto(v.path)
      await expect(page.getByText(v.ready).first()).toBeVisible({ timeout: 15_000 })
      await page.waitForLoadState('networkidle')

      expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl')
      expect(await page.evaluate(() => document.documentElement.lang)).toBe(language)

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, 'the page scrolls sideways').toBeLessThanOrEqual(1)

      // Wherever there is a rail beside the content, it is on the right (the reading side).
      const sides = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Account"]')?.getBoundingClientRect()
        const main = document.querySelector('main')?.getBoundingClientRect()
        return nav && main ? { navLeft: nav.left, mainLeft: main.left } : null
      })
      if (sides) expect(sides.navLeft, 'the rail should sit to the right of the content').toBeGreaterThan(sides.mainLeft)

      await page.screenshot({ path: `e2e/screenshots/${language}-${v.name}.png`, fullPage: false })
      const bad = blocking(await axeViolations(page))
      expect(bad, JSON.stringify(bad, null, 2)).toEqual([])
    })
  }
}
