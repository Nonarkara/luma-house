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
    const typeRoles = await page.evaluate(() => ['.stage-head h1', '.theme-picker select', '.project-picker strong', '.zoom-control .zoom-label', '.top-actions button[aria-label="Furniture Catalog"]'].map(selector => getComputedStyle(document.querySelector(selector)!).fontSize))
    for (const size of typeRoles) expect(['22px', '16px', '12px']).toContain(size)
    const plot = await page.locator('.plan-viewport').boundingBox()
    const sheet = await page.locator('.plan-canvas').boundingBox()
    expect(sheet!.width, 'the physical drawing must not collapse inside a size container').toBeGreaterThan(200)
    expect(sheet!.height).toBeGreaterThan(140)
    expect(sheet!.width / sheet!.height).toBeCloseTo(1.4, 1)
    for (const selector of ['.scale-chip', '.zoom-control', '.science-preview', '.value-lens-launch', '.plan-room-key']) {
      const r = await page.locator(selector).boundingBox()
      const intersects = r!.x < plot!.x + plot!.width && r!.x + r!.width > plot!.x && r!.y < plot!.y + plot!.height && r!.y + r!.height > plot!.y
      expect(intersects, `${selector} stays outside the drawing viewport`).toBe(false)
    }
    const calibrate = await page.getByRole('button', { name: 'Calibrate', exact: true }).boundingBox()
    const lens = await page.getByRole('button', { name: 'Open value lens', exact: true }).boundingBox()
    expect(calibrate!.x + calibrate!.width, 'the value-lens button must not cover Calibrate').toBeLessThanOrEqual(lens!.x)
    await expect(page.locator('.plan-room-key button')).toHaveCount(initialPlan.rooms.length)
    await expect(page.locator('.plan-room-key .room-name')).toHaveText(initialPlan.rooms.map(room => room.name))
    for (const selector of ['.journey-step', '.toolbar-pill-btn', '.plan-room-key button', '.top-actions button']) {
      for (const button of await page.locator(selector).all()) {
        const r = await button.boundingBox()
        expect(r!.x).toBeGreaterThanOrEqual(0)
        expect(r!.x + r!.width).toBeLessThanOrEqual(width)
        expect(r!.height).toBeGreaterThanOrEqual(44)
        expect(r!.width).toBeGreaterThanOrEqual(44)
      }
    }
    await page.locator('.plan-room-key button').first().focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.plan-room-key button').first()).toHaveAttribute('aria-pressed', 'true')
    const history = await page.getByRole('button', { name: 'Undo', exact: true }).boundingBox()
    const context = await page.locator('.contextual-action-bar').boundingBox()
    expect(context!.y).toBeGreaterThanOrEqual(history!.y + history!.height)
    await page.locator('.plan-room-key').hover()
    await page.mouse.wheel(0, -80)
    await expect(page.getByRole('button', { name: 'Fit plan to view', exact: true })).toHaveText('Fit')
    expect(await page.locator('.plan-room-key').evaluate(el => {
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -80 })
      el.dispatchEvent(event)
      return event.defaultPrevented
    }), 'margin scrolling is not captured by the drawing').toBe(false)
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
    await page.locator('.journey-step').filter({ hasText: 'Systems' }).click()
    await check(['.energy-hero .eyebrow', '.energy-hero strong', '.energy-hero span', '.system-row strong', '.system-row small', '.saving'])
    await page.getByRole('button', { name: 'Collapse inspector', exact: true }).click()
    await page.getByRole('button', { name: 'Layout presets', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await check(['.trace-review h2', '.trace-review p', '.trace-review select', '.trace-review .button.primary'])
    await page.getByRole('button', { name: 'Keep current project', exact: true }).click()
    await page.getByRole('button', { name: 'Room options', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Room options', exact: true })).toBeVisible()
    await check(['.room-options-dialog p', '.room-options-dialog h2', '.room-options-dialog select', '.room-options-dialog button:not(:disabled)', '.room-option-metrics th', '.room-option-metrics td'])
    expect(await page.locator('.room-options-dialog').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
    for (const button of await page.locator('.room-options-dialog button').all()) expect(await button.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
    await page.getByRole('button', { name: 'Close room options', exact: true }).click()
    await page.getByRole('button', { name: 'Spatial', exact: true }).click()
    await expect(page.getByRole('button', { name: '3D Orbit', exact: true })).toBeVisible()
    await check(['.spatial-tb-btn.active', '.spatial-sun-hud strong', '.science-seasons button.active'])
    await page.getByRole('button', { name: 'Saved views', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Saved study views' })).toBeVisible()
    await check(['.study-dialog p', '.study-dialog label', '.study-dialog input', '.study-dialog button'])
    expect(await page.locator('.study-dialog').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
    for (const button of await page.locator('.study-dialog button').all()) expect(await button.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
    await page.getByRole('button', { name: 'Close saved views', exact: true }).click()
    await page.getByRole('button', { name: 'Study sheet', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Printable study sheet' })).toBeVisible()
    await check(['.study-paper h1', '.study-paper p', '.study-paper h2', '.study-dialog button', '.study-paper footer'])
    expect(await page.locator('.study-dialog').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
    await page.getByRole('button', { name: 'Close study sheet', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    expect(await page.locator('.canvas-frame').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(300)
  })
}
