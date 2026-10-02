import { test, expect } from '@playwright/test'
import { themes } from '../src/design/themes'
import { initialPlan } from '../src/plan'
import { encodePlanToHash } from '../src/sharePlan'
const hash = encodePlanToHash(initialPlan)

for (const theme of themes) for (const width of [375, 768, 1280]) {
  test(`${theme.name}: persisted appearance and intact workspace at ${width}px`, async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
    await page.setViewportSize({ width, height: 844 })
    await page.goto(`/#plan=${hash}`)
    await page.getByLabel('Colour scheme', { exact: true }).selectOption(theme.id)
    await expect(page.getByText('Saved locally', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id)
    await expect(page.getByLabel('Colour scheme', { exact: true })).toHaveValue(theme.id)
    await expect(page.locator('button.room')).toHaveCount(initialPlan.rooms.length)
    const check = async (selectors: string[]) => {
      const result = await page.evaluate(selectors => {
        const rgba = (color: string) => color.match(/[\d.]+/g)!.map(Number)
        const lum = (rgb: number[]) => rgb.slice(0, 3).map(v => v / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
        return selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)).filter(e => e.getBoundingClientRect().width > 0).map(el => {
          const layers: number[][] = []
          for (let parent: Element | null = el; parent; parent = parent.parentElement) layers.unshift(rgba(getComputedStyle(parent).backgroundColor))
          let bg = [255, 255, 255]
          for (const layer of layers) { const a = layer.length === 4 ? layer[3] : 1; bg = bg.map((value, i) => layer[i] * a + value * (1 - a)) }
          const fg = rgba(getComputedStyle(el).color)
          const a = fg.length === 4 ? fg[3] : 1
          const front = fg.slice(0, 3).map((value, i) => value * a + bg[i] * (1 - a))
          const l1 = lum(front), l2 = lum(bg)
          return { selector, ratio: (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05) }
        }))
      }, selectors)
      for (const { selector, ratio } of result) expect(ratio, `${theme.name} ${selector}`).toBeGreaterThanOrEqual(4.5)
    }
    await check(['.stage-head h1', '.theme-picker select', '.button.primary', '.journey-headline', '.room-name', '.room-area', '.scale-chip button', '.science-preview strong', '.toolbar-pill-btn.is-active'])
    await page.getByRole('button', { name: 'Open panel', exact: true }).click()
    await check(['.inspector-head h2', '.inspector input', '.code-issue-title', '.code-issue-fix', '.style-preset-btn span', '.inspector .text-button'])
    await page.getByRole('button', { name: 'Collapse inspector', exact: true }).click()
    await page.locator('.journey-step').filter({ hasText: 'Cost' }).click()
    await check(['.inspector strong', '.inspector .button.dark'])
    await page.getByRole('button', { name: 'Collapse inspector', exact: true }).click()
    await page.getByRole('button', { name: 'Layout presets', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await check(['.trace-review h2', '.trace-review p', '.trace-review select', '.trace-review .button.primary'])
    await page.getByRole('button', { name: 'Keep current project', exact: true }).click()
    await page.getByRole('button', { name: 'Spatial', exact: true }).click()
    await expect(page.getByRole('button', { name: '3D Orbit', exact: true })).toBeVisible()
    await check(['.spatial-tb-btn.active', '.spatial-sun-hud strong', '.science-seasons button.active'])
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    expect(await page.locator('.canvas-frame').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(300)
  })
}
