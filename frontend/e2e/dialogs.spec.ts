import { expect, test } from '@playwright/test'
import { axeViolations, blocking } from './support/a11y'
import { installApi } from './support/mockApi'

// Dialogs: focus goes inside when one opens, the keyboard cannot leave it, Escape closes it, focus returns to the button
// that opened it, and the open dialog passes the same accessibility rules.
const CASES = [
  { name: 'argument map: add a point', path: '/projects/12/argument-map', opener: /^Add a point$/, title: /Add a point/ },
  { name: 'members: invite', path: '/projects/12/members', opener: /Invite/, title: /Invite/ },
  { name: 'findings: new document', path: '/projects/12/findings', opener: /^New document$/, title: /New document/i },
] as const

for (const c of CASES) {
  test(`dialog ${c.name}`, async ({ page }) => {
    await installApi(page, { signedIn: true })
    await page.goto(c.path)
    const opener = page.getByRole('button', { name: c.opener }).first()
    await expect(opener).toBeVisible({ timeout: 15_000 })
    await opener.focus()
    await opener.press('Enter')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading').first()).toContainText(c.title)
    expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null), 'focus is inside the dialog').toBe(true)

    // Tab round the dialog twice: focus is in the dialog, or on the browser's own controls (the document body), and never on
    // anything of the page behind it.
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press('Tab')
      const where = await page.evaluate(() => {
        const a = document.activeElement
        return a === document.body || a === document.documentElement ? 'browser' : a?.closest('dialog') ? 'dialog' : `page: ${a?.tagName} ${a?.textContent?.slice(0, 30)}`
      })
      expect(['dialog', 'browser'], `after Tab ${i + 1}: ${where}`).toContain(where)
    }
    // Back inside before closing, so Escape reaches the dialog.
    await dialog.getByRole('heading').first().evaluate((h) => (h.closest('dialog')!.querySelector('input,select,textarea,button') as HTMLElement | null)?.focus())

    const bad = blocking(await axeViolations(page))
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([])

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    const back = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent?.trim())
    expect(back, 'focus goes back to the button that opened the dialog').toBe((await opener.textContent())?.trim())
  })
}

test('the first Tab on a signed-in page offers to skip to the content, and it works', async ({ page }) => {
  await installApi(page, { signedIn: true })
  await page.goto('/projects/12/overview')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15_000 })
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: /skip to/i })
  await expect(skip).toBeFocused()
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => location.hash)).toBe('#main')
})
