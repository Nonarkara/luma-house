import { test, expect } from '@playwright/test'
import { initialPlan } from '../src/plan'
import { chinaApartmentPlan, CHINA_PROJECT_KEY } from '../src/mockups/chinaApartment'
import { decodePlanFromHash, encodePlanToHash } from '../src/sharePlan'

test('parallel architectural views preserve camera, civil time and styles across save, share and reload', async ({ page }) => {
  await page.goto('/#plan=' + encodePlanToHash(chinaApartmentPlan))
  await page.getByRole('button', { name: 'Renders', exact: true }).click()
  const canvas = page.locator('.spatial3d-shell canvas')
  await expect.poll(() => canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL().length), { timeout: 20000 }).toBeGreaterThan(10000)
  await expect(page.getByRole('button', { name: 'Architectural', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Top-Down', exact: true }).click()
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await page.getByLabel('Study view name', { exact: true }).fill('North-up morning')
  await page.getByLabel('Study date', { exact: true }).fill('2025-06-21')
  await page.getByLabel('Study local time', { exact: true }).fill('09:15')
  await page.getByRole('button', { name: 'Save current view', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Saved study views' }).getByRole('status')).toHaveText('View added to project; preview cached on this device.')
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), CHINA_PROJECT_KEY)
  await expect.poll(async () => (await saved()).studyScenes?.length).toBe(1)
  const scene = (await saved()).studyScenes[0]
  expect(scene.camera.projection).toBe('orthographic')
  expect(scene.camera.up).toEqual([0, 0, -1])
  expect(scene.camera.position[0]).toBeCloseTo(scene.camera.target[0], 8)
  expect(scene.camera.position[2]).toBeCloseTo(scene.camera.target[2], 8)
  expect(scene.year).toBe(2025); expect(scene.day).toBe(172); expect(scene.hour).toBe(9.25)
  await page.getByRole('button', { name: 'Close saved views', exact: true }).click()
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  const url = await page.evaluate(() => navigator.clipboard.readText())
  expect(decodePlanFromHash(new URL(url).hash)?.studyScenes).toEqual([scene])
  await page.reload()
  await expect(page.locator('button.room')).toHaveCount(chinaApartmentPlan.rooms.length)
  await page.getByRole('button', { name: 'Renders', exact: true }).click()
  await page.getByRole('button', { name: '3D Orbit', exact: true }).click()
  await page.getByRole('button', { name: 'Wireframe', exact: true }).click()
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await page.getByRole('button', { name: 'Open North-up morning', exact: true }).click()
  await expect(page.locator('.spatial3d-shell')).toHaveAttribute('data-projection', 'orthographic')
  await expect(page.locator('.spatial3d-shell')).toHaveAttribute('data-style', 'architectural')
  await expect(page.locator('.spatial-sun-hud')).toContainText('2025')
  await expect(page.locator('.spatial-sun-hud')).toContainText('09:15')
})

test('three sun comparisons contain distinct actual frames from the same camera without AI', async ({ page }) => {
  const calls: string[] = []
  await page.route('**/luma-concept-render.drnon.workers.dev/**', r => { calls.push(r.request().url()); return r.abort() })
  await page.goto('/#plan=' + encodePlanToHash(initialPlan))
  await page.getByRole('button', { name: 'Renders', exact: true }).click()
  const canvas = page.locator('.spatial3d-shell canvas')
  await expect.poll(() => canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL().length), { timeout: 20000 }).toBeGreaterThan(10000)
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await page.context().setOffline(true)
  await page.getByRole('button', { name: 'Compare 09:00 / 12:00 / 15:00', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Saved study views' }).getByRole('status')).toHaveText('Three sun views added to project from the same camera.')
  const images = await page.locator('.study-scene-grid img').evaluateAll(els => els.map(el => (el as HTMLImageElement).src))
  expect(images).toHaveLength(3); expect(new Set(images).size).toBe(3)
  expect(images.every(image => image.startsWith('data:image/jpeg;base64,') && image.length > 1000)).toBe(true)
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').studyScenes?.length, CHINA_PROJECT_KEY)).toBe(3)
  const scenes = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').studyScenes, CHINA_PROJECT_KEY)
  expect(scenes.map((s: { hour: number }) => s.hour)).toEqual([9, 12, 15])
  expect(scenes[0].camera).toEqual(scenes[1].camera); expect(scenes[1].camera).toEqual(scenes[2].camera)
  expect(calls).toEqual([])
})

test('study sheets retain physical SVG scale and fit one landscape PDF page even on small sites', async ({ page }, testInfo) => {
  await page.goto('/#plan=' + encodePlanToHash({ ...initialPlan, site: { w: 3, h: 2, unit: 1 } }))
  await page.getByRole('button', { name: 'Renders', exact: true }).click()
  const canvas = page.locator('.spatial3d-shell canvas')
  await expect.poll(() => canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL().length), { timeout: 20000 }).toBeGreaterThan(10000)
  await page.getByRole('button', { name: 'Study sheet', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Printable study sheet' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Measured plan at 1:100', exact: true })).toHaveAttribute('width', '46mm')
  await expect(page.getByRole('img', { name: 'Section A–A at 1:100', exact: true })).toBeVisible()
  await expect(page.locator('.study-captured-view')).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => document.fonts.ready)
  const overflow = await page.locator('.study-paper').evaluate(el => {
    const footer = el.querySelector('footer')!.getBoundingClientRect(), chart = el.querySelector('.sun-chart')!.getBoundingClientRect()
    return chart.bottom > footer.top + 1
  })
  expect(overflow).toBe(false)
  const pdf = await page.pdf({ path: testInfo.outputPath('study-sheet.pdf'), preferCSSPageSize: true, printBackground: true })
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBe(1)
  await page.emulateMedia({ media: 'screen' })
  await page.getByRole('button', { name: 'Close study sheet', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Printable study sheet' })).toHaveCount(0)
})

test('camera movement reuses actual offscreen shadow drawing and sun changes rebuild it', async ({ page }) => {
  await page.addInitScript(() => {
    const target = window as Window & { shadowDraws?: number }
    target.shadowDraws = 0
    const bound = new WeakMap<WebGL2RenderingContext, boolean>()
    const bind = WebGL2RenderingContext.prototype.bindFramebuffer
    WebGL2RenderingContext.prototype.bindFramebuffer = function (type, buffer) {
      if (type === this.FRAMEBUFFER || type === this.DRAW_FRAMEBUFFER) bound.set(this, buffer !== null)
      return bind.call(this, type, buffer)
    }
    for (const method of ['drawArrays', 'drawElements'] as const) {
      const original = WebGL2RenderingContext.prototype[method]
      WebGL2RenderingContext.prototype[method] = function (...args: never[]) {
        if (bound.get(this)) target.shadowDraws = (target.shadowDraws ?? 0) + 1
        return (original as (...values: never[]) => void).apply(this, args)
      }
    }
  })
  const draws = () => page.evaluate(() => (window as Window & { shadowDraws?: number }).shadowDraws ?? 0)
  await page.goto('/#plan=' + encodePlanToHash(initialPlan))
  await page.getByRole('button', { name: 'Renders', exact: true }).click()
  await expect.poll(draws, { timeout: 20000 }).toBeGreaterThan(0)
  await page.waitForTimeout(1000)
  const before = await draws()
  await page.getByRole('button', { name: 'Top-Down', exact: true }).click()
  await page.waitForTimeout(600)
  expect(await draws()).toBe(before)
  await page.getByRole('button', { name: 'Wireframe', exact: true }).click()
  await page.getByLabel('3D section cut height', { exact: true }).press('ArrowRight')
  await page.waitForTimeout(600)
  expect(await draws()).toBe(before)
  const adjust = page.getByRole('button', { name: 'Adjust', exact: true })
  if (await adjust.isVisible()) await adjust.click()
  await page.getByLabel('Sun time of day', { exact: true }).press('ArrowRight')
  await expect.poll(draws).toBeGreaterThan(before)
})

test('old previews are marked when the drawing changes and recover with undo', async ({ page }) => {
  await page.goto('/#plan=' + encodePlanToHash(initialPlan))
  await page.getByRole('button', { name: 'Renders', exact: true }).click()
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await page.getByRole('button', { name: 'Save current view', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Saved study views' }).getByRole('status')).toHaveText('View added to project; preview cached on this device.')
  const original = await page.locator('.study-scene-grid img').getAttribute('src')
  await page.getByRole('button', { name: 'Close saved views', exact: true }).click()
  await page.getByRole('button', { name: 'Plan', exact: true }).click()
  await page.locator('button.room').first().focus()
  await page.locator('button.room').first().press('Enter')
  await page.getByRole('button', { name: 'Increase ceiling height', exact: true }).click()
  await page.getByRole('button', { name: 'Renders', exact: true }).click()
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await expect(page.getByText('Earlier drawing · update preview to refresh', { exact: true })).toBeVisible()
  await expect(page.locator('.study-scene-grid img')).toHaveAttribute('src', original!)
  await page.getByRole('button', { name: 'Close saved views', exact: true }).click()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await expect(page.getByText('Captured from this drawing', { exact: true })).toBeVisible()
})
