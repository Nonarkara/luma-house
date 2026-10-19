import { expect, type Page } from '@playwright/test'
export async function clickTool(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true })
  if (!(await button.first().isVisible())) {
    await page.getByRole('button', { name: 'More tools', exact: true }).click()
  }
  await button.first().click()
}

export async function openMore(page: Page) {
  const more = page.getByRole('button', { name: 'More actions', exact: true })
  if (!(await page.locator('.top-more').getAttribute('open') !== null)) await more.click()
}
export async function clickAction(page: Page, name: string) {
  const action = page.getByRole('button', { name, exact: true })
  if (!await action.isVisible()) await openMore(page)
  await action.click()
}
export async function chooseTheme(page: Page, id: string) {
  await openMore(page)
  await page.getByLabel('Colour scheme', { exact: true }).selectOption(id)
  await page.getByRole('button', { name: 'More actions', exact: true }).press('Escape')
}
export async function openCity(page: Page) {
  const direct = page.locator('.topbar-meta .location-toggle')
  if (await direct.isVisible()) await direct.click()
  else { await openMore(page); await page.getByRole('button', { name: /^Change city ·/ }).click() }
  await expect(page.getByLabel('Search any city', { exact: true })).toBeVisible()
}
export async function pickSuggestedCity(page: Page, name: RegExp) {
  const starters = page.locator('details.city-starters')
  if (await starters.count() && !(await starters.evaluate(d => (d as HTMLDetailsElement).open))) await starters.locator('summary').click()
  await page.getByRole('button', { name }).click()
}
export async function expectCity(page: Page, name: string) {
  const direct = page.locator('.topbar-meta .location-toggle')
  if (await direct.isVisible()) await expect(direct).toHaveAttribute('aria-label', new RegExp(name))
  else { await openMore(page); await expect(page.getByRole('button', { name: new RegExp(`^Change city · ${name}`) })).toBeVisible(); await page.getByRole('button', { name: 'More actions', exact: true }).press('Escape') }
}

export async function expectSaved(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) <= 720) await openMore(page)
  await expect(page.getByText('Saved locally', { exact: true }).filter({ visible: true })).toBeVisible()
  if (await page.locator('.top-more').getAttribute('open') !== null) await page.getByRole('button', { name: 'More actions', exact: true }).press('Escape')
}
