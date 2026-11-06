import { expect, test } from '@playwright/test'
import { encodePlanToHash } from '../src/sharePlan'
import { initialPlan } from '../src/plan'
import { clickAction } from './workspace'

for (const width of [390, 1024, 1440]) {
  test(`catalogue filters preserve inventory space and keyboard access at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/#plan=' + encodePlanToHash(initialPlan))
    await clickAction(page, 'Furniture Catalog')
    const categories = page.getByRole('navigation', { name: 'Categories' })
    const bounds = await categories.boundingBox()
    expect(bounds!.height, 'seven short filters earn one control row, including its visible scroll rail').toBeLessThanOrEqual(48)
    const buttons = categories.getByRole('button')
    expect(await buttons.count()).toBe(7)
    const geometry = await buttons.evaluateAll(nodes => nodes.map(node => {
      const r = node.getBoundingClientRect(), style = getComputedStyle(node)
      return { y: r.y, height: r.height, font: parseFloat(style.fontSize) }
    }))
    expect(new Set(geometry.map(r => r.y)).size).toBe(1)
    for (const r of geometry) { expect(r.height).toBeGreaterThanOrEqual(32); expect(r.font).toBeGreaterThanOrEqual(12) }
    await buttons.first().focus()
    for (let i = 1; i < 7; i++) await page.keyboard.press('Tab')
    const bath = categories.getByRole('button', { name: 'Bath', exact: true })
    await expect(bath).toBeFocused()
    const reachable = await bath.evaluate(el => {
      const r = el.getBoundingClientRect()
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el
    })
    expect(reachable).toBe(true)
    await bath.press('Enter')
    await expect(page.locator('.catalog-card')).toHaveCount(1)
    await expect(page.getByRole('button', { name: /^Add WC,/ })).toBeVisible()
    await page.getByRole('button', { name: 'All Items', exact: true }).click()
    await expect(page.locator('.catalog-card')).toHaveCount(14)
    await page.getByLabel('Filter furniture catalog').fill('Velvet')
    await expect(page.locator('.catalog-card')).toHaveCount(1)
    expect((await page.locator('.catalog-card').boundingBox())!.height, 'one search result must not stretch into an inventory-sized box').toBeLessThanOrEqual(90)
    await page.addStyleTag({ content: '.furniture-catalog-drawer { --font-note: 24px; }' })
    await expect(page.locator('.catalog-card')).toBeVisible()
    await bath.focus()
    await expect(bath).toBeFocused()
    const enlarged = await bath.evaluate(el => {
      const r = el.getBoundingClientRect()
      return { font: parseFloat(getComputedStyle(el).fontSize), reachable: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el }
    })
    expect(enlarged.font).toBe(24)
    expect(enlarged.reachable).toBe(true)
  })
}
