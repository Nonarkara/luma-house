import { test, expect } from '@playwright/test'
import { encodePlanToHash } from '../src/sharePlan'
import type { PlanState } from '../src/types'
import { themes } from '../src/design/themes'

const plan: PlanState = {
  site: { w: 10, h: 8, unit: 1 },
  rooms: [{ id: 'room', name: 'Sun room', kind: 'living', x: 20, y: 20, w: 60, h: 60, wallHeight: 3 }],
  openings: [{ id: 'window', type: 'window', x: 50, y: 80, rotation: 0, sillHeightM: 0.9, heightM: 1.4, widthM: 2 }],
  furniture: [], systems: { solar: false, lighting: false, climate: false, insulation: false },
}
const hash = encodePlanToHash(plan)

test('renders locally with AI blocked, supports every palette and exports an actual PNG', async ({ page }, testInfo) => {
  const calls: string[] = []
  await page.route('**/luma-concept-render.drnon.workers.dev/**', route => { calls.push(route.request().url()); return route.abort() })
  await page.goto(`/#plan=${hash}`)
  await page.getByRole('button', { name: 'Renders', exact: true }).click()
  await expect(page.getByLabel('Local 3D light study')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Architectural', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Shadows', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const canvas = page.locator('.spatial3d-shell canvas')
  await expect(canvas).toBeVisible()
  await expect.poll(() => canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL().length), { timeout: 20000 }).toBeGreaterThan(10000)
  for (const theme of themes) {
    await page.getByLabel('Colour scheme', { exact: true }).selectOption(theme.id)
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id)
    await expect(canvas).toBeVisible()
  }
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save view PNG' }).click()
  const download = await pending
  expect(download.suggestedFilename()).toMatch(/^designon-.*-architectural\.png$/)
  const fs = await import('node:fs/promises')
  await download.saveAs(testInfo.outputPath('window-light.png'))
  const bytes = await fs.readFile(testInfo.outputPath('window-light.png'))
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(bytes.length).toBeGreaterThan(10000)
  expect(calls).toEqual([])
})

test('shadow toggle changes rendered pixels and wireframe remains optional', async ({ page }) => {
  await page.goto(`/#plan=${hash}`)
  await page.getByRole('button', { name: 'Spatial', exact: true }).click()
  const canvas = page.locator('.spatial3d-shell canvas')
  await expect.poll(() => canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL().length), { timeout: 20000 }).toBeGreaterThan(10000)
  // Default orbit camera is stationary: these pixels must change because of
  // lighting, not a camera animation or the toolbar's pressed state.
  await page.waitForTimeout(300)
  const shadowed = await canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL())
  await page.getByRole('button', { name: 'Shadows', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Shadows', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL())).not.toBe(shadowed)
  await page.getByRole('button', { name: 'Wireframe', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Wireframe', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Plan', exact: true }).click()
  await expect(page.locator('button.room')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Sun room, 28.8 square meters' })).toBeVisible()
})

test('sun controls change local geometry lighting without an API request', async ({ page }) => {
  const calls: string[] = []
  await page.route('**/luma-concept-render.drnon.workers.dev/**', route => { calls.push(route.request().url()); return route.abort() })
  await page.goto(`/#plan=${hash}`)
  await page.getByRole('button', { name: 'Renders', exact: true }).click()
  const canvas = page.locator('.spatial3d-shell canvas')
  await expect.poll(() => canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL().length), { timeout: 20000 }).toBeGreaterThan(10000)
  const day = await canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL())
  await page.context().setOffline(true)
  const adjust = page.getByRole('button', { name: 'Adjust', exact: true })
  if (await adjust.isVisible()) await adjust.click()
  const slider = page.getByLabel('Sun time of day')
  await slider.focus()
  await slider.press('End')
  await expect(slider).toHaveValue('24')
  await expect.poll(() => canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL())).not.toBe(day)
  expect(calls).toEqual([])
})

test('the GPU rests while idle and redraws when the sun changes', async ({ page }) => {
  await page.addInitScript(() => {
    const target = window as Window & { studyDraws?: number }
    target.studyDraws = 0
    for (const method of ['drawArrays', 'drawElements'] as const) {
      const original = WebGL2RenderingContext.prototype[method]
      // Instrument actual GPU drawing, without changing app behavior.
      WebGL2RenderingContext.prototype[method] = function (...args: never[]) {
        target.studyDraws = (target.studyDraws ?? 0) + 1
        return (original as (...values: never[]) => void).apply(this, args)
      }
    }
  })
  const draws = () => page.evaluate(() => (window as Window & { studyDraws?: number }).studyDraws ?? 0)
  const expectIdle = async () => {
    // Software graphics runners take different amounts of wall time to finish
    // camera transitions. Require a full quiet interval, with a bounded wait;
    // a renderer that keeps drawing indefinitely must still fail.
    await expect.poll(async () => {
      const before = await draws()
      await page.waitForTimeout(600)
      if (await draws() !== before) return false
      await page.waitForTimeout(600)
      return await draws() === before
    }, { timeout: 20000 }).toBe(true)
    return draws()
  }
  await page.goto('/#plan=' + encodePlanToHash({ ...plan, site: { w: 30, h: 20, unit: 1 } }))
  await page.getByRole('button', { name: 'Renders', exact: true }).click()
  await expect.poll(draws, { timeout: 20000 }).toBeGreaterThan(0)
  const idle = await expectIdle()
  const adjust = page.getByRole('button', { name: 'Adjust', exact: true })
  if (await adjust.isVisible()) await adjust.click()
  await page.getByLabel('Sun time of day').focus()
  await page.getByLabel('Sun time of day').press('ArrowRight')
  await expect.poll(draws).toBeGreaterThan(idle)
  await page.getByRole('button', { name: 'Tour', exact: true }).click()
  await expectIdle()
  await page.getByRole('button', { name: 'Exit Guided Tour', exact: true }).click()
  await page.getByRole('button', { name: 'Axonometric', exact: true }).click()
  await expectIdle()
  await page.getByRole('button', { name: 'Walk at 1.6 m', exact: true }).click()
  await expectIdle()
})
