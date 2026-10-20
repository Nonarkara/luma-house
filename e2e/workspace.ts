import { expect, type Page } from '@playwright/test'
export async function openMore(page: Page) {
  const more = page.getByRole('button', { name: 'More actions', exact: true })
  if (!(await page.locator('.top-more').getAttribute('open') !== null)) await more.click()
}
export async function clickAction(page: Page, name: string) {
  const action = page.getByRole('button', { name, exact: true })
  if (!await action.isVisible()) await openMore(page)
  await action.click()
}
/** On a phone the inspector is a full-screen overlay that covers the top bar,
 *  so any top-bar action needs the panel closed first. */
export async function closeInspector(page: Page) {
  const collapse = page.getByRole('button', { name: 'Collapse inspector', exact: true })
  if (await collapse.count()) await collapse.click()
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
