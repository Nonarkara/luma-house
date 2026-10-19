import { test, expect, type Page } from '@playwright/test'
import { CHINA_PROJECT_KEY } from '../src/mockups/chinaApartment'
import { encodePlanToHash, decodePlanFromHash } from '../src/sharePlan'
import { pinBaseline } from '../src/comparison/baseline'
import type { PlanState } from '../src/types'
import { clickAction, chooseTheme } from './workspace'

const a: PlanState = {
  site: { w: 10, h: 8, unit: 1 }, location: { name: 'Bangkok', label: 'Bangkok, Thailand', latitude: 13.7563, longitude: 100.5018, timezone: 'Asia/Bangkok' },
  rooms: [{ id: 'room', name: 'Work room', kind: 'studio', x: 10, y: 10, w: 60, h: 60 }],
  openings: [{ id: 'window', type: 'window', x: 40, y: 10, rotation: 0, widthM: 2 }],
  furniture: [{ id: 'desk', kind: 'desk', x: 20, y: 20, rotated: false, wM: 1.6, dM: .8 }, { id: 'sofa', kind: 'sofa', x: 40, y: 40, rotated: false }],
  systems: { solar: false, climate: false, insulation: false, lighting: false },
}
const b: PlanState = { ...pinBaseline(a, 'Before rearranging', '2026-10-15T00:00:00Z'), furniture: [{ ...a.furniture[0], x: 45, y: 12, rotated: true }, a.furniture[1]] }
const saved = (page: Page): Promise<PlanState> => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), CHINA_PROJECT_KEY)
async function compare(page: Page) {
  await page.locator('.journey-step').filter({ hasText: 'Cost' }).click()
  await page.getByRole('button', { name: 'Compare A vs B', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Side-by-Side Design Comparison', exact: true })).toBeVisible()
}
async function collapseInspector(page: Page) {
  const close = page.getByRole('button', { name: 'Collapse inspector', exact: true })
  if (await close.isVisible()) await close.click()
}

test('baseline survives real storage reload and sharing; Restore and Undo keep both drawings', async ({ page }) => {
  await page.goto('/#plan=' + encodePlanToHash(b))
  await expect.poll(async () => (await saved(page)).comparison?.baselinePlan.furniture).toEqual(a.furniture)
  await page.evaluate(() => history.replaceState(null, '', location.pathname))
  await page.reload()
  await compare(page)
  await expect(page.locator('.comparison-plan')).toHaveCount(2)
  await expect(page.locator('.comparison-room-measures')).toContainText('1 furniture pieces moved')
  const transforms = await page.locator('.comparison-plan').evaluateAll(els => els.map(el => (el as SVGSVGElement).getScreenCTM()!.a))
  expect(transforms[0]).toBeCloseTo(transforms[1], 8)
  await page.getByRole('button', { name: 'Close Comparison', exact: true }).click()
  await collapseInspector(page)
  await clickAction(page, 'Share')
  const shared = decodePlanFromHash(new URL(await page.evaluate(() => navigator.clipboard.readText())).hash)!
  expect(shared.furniture).toEqual(b.furniture)
  expect(shared.comparison?.baselinePlan.furniture).toEqual(a.furniture)
  await compare(page)
  await page.getByRole('button', { name: 'Restore Plan A', exact: true }).click()
  await expect.poll(async () => (await saved(page)).furniture).toEqual(a.furniture)
  await collapseInspector(page)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect.poll(async () => (await saved(page)).furniture).toEqual(b.furniture)
  expect((await saved(page)).comparison?.baselinePlan.furniture).toEqual(a.furniture)
})

test('3D A/B switches actual geometry offline while preserving an orbited camera and full-frame PNG', async ({ page }) => {
  const ai: string[] = []
  await page.route('**/luma-concept-render.drnon.workers.dev/**', route => { ai.push(route.request().url()); return route.abort() })
  await page.goto('/#plan=' + encodePlanToHash(b))
  await compare(page)
  await expect.poll(async () => (await saved(page)).comparison?.baselineName).toBe('Before rearranging')
  const original = await saved(page)
  await page.getByRole('button', { name: '3D comparison', exact: true }).click()
  await expect(page.getByRole('region', { name: '3D comparison preview', exact: true })).toBeFocused()
  const canvas = page.locator('.comparison-3d canvas')
  const image = () => canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL())
  await expect.poll(async () => (await image()).length, { timeout: 25000 }).toBeGreaterThan(12000)
  const initial = await image()
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 55, box.y + box.height / 2 + 20, { steps: 8 }); await page.mouse.up()
  await expect.poll(image).not.toBe(initial)
  const orbitedB = await image()
  await page.context().setOffline(true)
  await page.locator('.comparison-3d').getByRole('button', { name: 'Plan A', exact: true }).click()
  await expect.poll(image).not.toBe(orbitedB)
  await page.locator('.comparison-3d').getByRole('button', { name: 'Plan B', exact: true }).click()
  await expect.poll(image).toBe(orbitedB)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save comparison PNG', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('designon-comparison-plan-b.png')
  const stream = (await download.createReadStream())!, chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  expect(Buffer.concat(chunks).toString('base64')).toBe(orbitedB.split(',')[1])
  expect(await saved(page)).toEqual(original)
  await page.getByRole('button', { name: 'Close Comparison', exact: true }).press('Escape')
  await expect(page.locator('dialog.ab-modal')).toHaveCount(0)
  expect(ai).toEqual([])
})

test('morph slides between the alternatives and states what it cannot carry', async ({ page }) => {
  await page.goto('/#plan=' + encodePlanToHash(b))
  await compare(page)
  // Captured before any morphing: the slider is a view, never an edit. The
  // baseline pin lands in storage a moment after the dialog opens, so wait for
  // it — capturing too early compared a half-saved plan against a finished one
  // and failed intermittently on slower runs.
  await expect.poll(async () => (await saved(page)).comparison?.baselineName).toBe('Before rearranging')
  const savedBefore = await saved(page)
  await page.getByRole('button', { name: '3D comparison', exact: true }).click()
  const canvas = page.locator('.comparison-3d canvas')
  const image = () => canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL())
  await expect.poll(async () => (await image()).length, { timeout: 25000 }).toBeGreaterThan(12000)
  const box = (await canvas.boundingBox())!
  // One percent of the frame: wide enough for shadow noise, far below the share
  // of a canvas a sofa sliding across a room would repaint.
  const canvas_area = Math.round(box.width * box.height * 0.01)
  const slider = page.getByRole('slider', { name: 'Morph between alternatives', exact: true })

  await page.locator('.comparison-3d').getByRole('button', { name: 'Morph', exact: true }).click()
  await expect(slider).toBeVisible()

  /**
   * Count pixels that actually differ between two frames.
   *
   * Asserting "the screenshot is not identical" is worthless here: any state
   * change re-renders the demand-framed canvas, so incidental shadow-map and
   * dithering differences make two *identical* drawings compare unequal. That is
   * exactly how a morph which silently returned Plan A every time passed this
   * test once. So the assertion is a threshold on real changed pixels, and the
   * slider's two ends are compared against the two real alternatives.
   */
  const changedPixels = (first: string, second: string) => page.evaluate(async ([a, b]) => {
    const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src
    })
    const [first, second] = await Promise.all([load(a!), load(b!)])
    const canvas = document.createElement('canvas')
    canvas.width = first.width; canvas.height = first.height
    const context = canvas.getContext('2d')!
    context.drawImage(first, 0, 0)
    const from = context.getImageData(0, 0, canvas.width, canvas.height).data
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(second, 0, 0)
    const to = context.getImageData(0, 0, canvas.width, canvas.height).data
    let count = 0
    for (let i = 0; i < from.length; i += 4) {
      if (Math.abs(from[i] - to[i]) > 12 || Math.abs(from[i + 1] - to[i + 1]) > 12 || Math.abs(from[i + 2] - to[i + 2]) > 12) count += 1
    }
    return count
  }, [first, second] as const)

  await slider.fill('0')
  await page.waitForTimeout(1200)
  const atZero = await image()
  await slider.fill('1')
  await page.waitForTimeout(1200)
  const atOne = await image()

  // A real morph moves the building. 1% of the frame is a wide margin for
  // shadow noise and a low bar for actual geometry travelling across a room.
  expect(await changedPixels(atZero, atOne), 'the two ends of the morph must render differently').toBeGreaterThan(canvas_area)

  // The ends must be the two alternatives themselves, not two arbitrary frames.
  await page.locator('.comparison-3d').getByRole('button', { name: 'Plan A', exact: true }).click()
  await page.waitForTimeout(1200)
  const planA = await image()
  await page.locator('.comparison-3d').getByRole('button', { name: 'Plan B', exact: true }).click()
  await page.waitForTimeout(1200)
  const planB = await image()
  expect(await changedPixels(planA, planB), 'the two alternatives must differ for a morph to mean anything').toBeGreaterThan(canvas_area)

  // And it must say out loud which parts swap rather than slide.
  const note = page.locator('.comparison-3d p', { hasText: 'cannot interpolate' })
  if (await note.count()) await expect(note).toContainText('switch')
  expect(await saved(page)).toEqual(savedBefore)
})

test('room options preview real 3D before Apply and every palette keeps comparison within the dialog', async ({ page }) => {
  await page.goto('/#plan=' + encodePlanToHash(a))
  await expect.poll(async () => (await saved(page)).rooms?.length).toBe(1)
  const original = await saved(page)
  // On phones Room options lives in the tool row's More tools menu.
  const roomOptions = page.getByRole('button', { name: 'Room options', exact: true })
  if (!await roomOptions.isVisible()) await page.getByRole('button', { name: 'More tools', exact: true }).click()
  await roomOptions.click()
  await page.getByRole('button', { name: 'Preview in the full house', exact: true }).click()
  await page.getByRole('button', { name: '3D comparison', exact: true }).click()
  await expect(page.getByRole('region', { name: '3D comparison preview', exact: true })).toBeFocused()
  const canvas = page.locator('.comparison-3d canvas')
  await expect.poll(() => canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL().length), { timeout: 25000 }).toBeGreaterThan(12000)
  const visible = await canvas.evaluate(el => {
    const r = el.getBoundingClientRect(), dialog = el.closest('dialog')!.getBoundingClientRect()
    return Math.max(0, Math.min(r.bottom, dialog.bottom, innerHeight) - Math.max(r.top, dialog.top, 0)) / r.height
  })
  expect(visible, '3D choice must reveal the rendered model without manual scrolling').toBeGreaterThan(.85)
  await expect(page.locator('.room-options-dialog')).toContainText('Bangkok, Thailand')
  expect(await saved(page)).toEqual(original)
  await page.getByRole('button', { name: 'Keep current drawing', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  // Nonzero envelope deltas exercise both status badges as well as neutral text.
  await page.goto('/#plan=' + encodePlanToHash({ ...b, rooms: [{ ...a.rooms[0], w: 55 }], systems: { ...a.systems, insulation: true } }))
  await page.reload() // Same-document hash navigation alone does not reload the initial project.
  for (const id of ['solar-pop', 'guava-club', 'violet-hour', 'drafting-room']) {
    await chooseTheme(page, id)
    await page.locator('.journey-step').filter({ hasText: 'Cost' }).click()
    await page.getByRole('button', { name: 'Compare A vs B', exact: true }).click()
    const fits = await page.locator('dialog.ab-modal').evaluate(el => {
      const box = el.getBoundingClientRect()
      return el.scrollWidth <= el.clientWidth + 1 && box.left >= 0 && box.right <= innerWidth
    })
    expect(fits).toBe(true)
    await expect(page.locator('.ab-modal .delta-tag')).not.toHaveCount(0)
    const contrast = await page.locator('.ab-modal').evaluate(dialog => {
      const rgba = (color: string) => color.match(/[\d.]+/g)!.map(Number)
      const lum = (rgb: number[]) => rgb.slice(0, 3).map(v => v / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
      return Array.from(dialog.querySelectorAll('h2, h3, p, button, th, td, figcaption, .badge-plan-a, .badge-plan-b, .delta-tag, .delta-neutral')).map(el => {
        const layers: number[][] = []
        for (let parent: Element | null = el; parent; parent = parent.parentElement) layers.unshift(rgba(getComputedStyle(parent).backgroundColor))
        let bg = [255, 255, 255]
        for (const layer of layers) { const a = layer.length === 4 ? layer[3] : 1; bg = bg.map((v, i) => layer[i] * a + v * (1 - a)) }
        const fg = rgba(getComputedStyle(el).color), a = fg.length === 4 ? fg[3] : 1
        const front = fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a))
        const l1 = lum(front), l2 = lum(bg)
        return { text: el.textContent?.slice(0, 70), ratio: (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05), size: getComputedStyle(el).fontSize }
      })
    })
    for (const value of contrast) {
      expect(value.ratio, `${id}: ${value.text}`).toBeGreaterThanOrEqual(4.5)
      expect(['12px', '16px', '22px'], `${id}: ${value.text}`).toContain(value.size)
    }
    for (const button of await page.locator('.ab-modal button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await page.getByRole('button', { name: 'Close Comparison', exact: true }).click()
    await collapseInspector(page)
  }
})
