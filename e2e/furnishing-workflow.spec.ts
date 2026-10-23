import { expect, test, type Page } from '@playwright/test'
import { decodePlanFromHash, encodePlanToHash } from '../src/sharePlan'
import { initialPlan, furnitureRectFor } from '../src/plan'
import { CHINA_PROJECT_KEY } from '../src/mockups/chinaApartment'
import { furniturePlacementIssues } from '../src/canvas/furniturePlacement'
import { chooseTheme, clickAction } from './workspace'
import type { PlanState } from '../src/types'

const fixture: PlanState = { ...initialPlan, site: { w: 10, h: 8, unit: 1 }, rooms: [{ id: 'drawn', name: 'Drawn room', kind: 'studio', x: 10, y: 10, w: 70, h: 70 }], furniture: [], openings: [] }
const saved = (page: Page): Promise<PlanState> => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), CHINA_PROJECT_KEY)

async function addSofa(page: Page) {
  await page.goto('/#plan=' + encodePlanToHash(fixture))
  await page.getByRole('button', { name: /^Select Drawn room/ }).click()
  await clickAction(page, 'Furniture Catalog')
  await page.getByRole('button', { name: /Add Velvet sofa/ }).click()
  await expect.poll(async () => (await saved(page)).furniture?.length).toBe(1)
}
async function spatial(page: Page) {
  await page.getByRole('button', { name: 'Spatial', exact: true }).click()
  await expect(page.getByLabel('Furniture in 3D', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.spatial-model canvas')).toBeVisible()
}
async function captureCamera(page: Page, name: string) {
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await page.getByLabel('Study view name').fill(name)
  await page.getByRole('button', { name: 'Save current view', exact: true }).click()
  await expect.poll(async () => (await saved(page)).studyScenes?.at(-1)?.name).toBe(name)
  await page.getByRole('button', { name: 'Close saved views', exact: true }).click()
  return (await saved(page)).studyScenes!.at(-1)!.camera
}

test.describe('draw, furnish and inspect the same model', () => {
  test.describe.configure({ timeout: 180_000 })

  test('a drawn room accepts measured furniture; 3D edits persist through Undo and Share', async ({ page }) => {
    const errors: string[] = [], ai: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (/\/(trace|render)$/.test(new URL(request.url()).pathname)) ai.push(request.url()) })
    await page.addInitScript(() => {
      const target = window as Window & { furnishingShadowDraws?: number }, bound = new WeakMap<WebGL2RenderingContext, boolean>()
      const bind = WebGL2RenderingContext.prototype.bindFramebuffer, draw = WebGL2RenderingContext.prototype.drawElements
      WebGL2RenderingContext.prototype.bindFramebuffer = function (type, buffer) { if (type === this.FRAMEBUFFER || type === this.DRAW_FRAMEBUFFER) bound.set(this, buffer !== null); return bind.call(this, type, buffer) }
      WebGL2RenderingContext.prototype.drawElements = function (...args) { if (bound.get(this)) target.furnishingShadowDraws = (target.furnishingShadowDraws ?? 0) + 1; return draw.apply(this, args) }
    })
    // Draw a real closed loop, rather than merely seeding an already furnished room.
    await page.goto('/#plan=' + encodePlanToHash({ ...fixture, rooms: [], walls: [] }))
    await page.getByRole('button', { name: 'Pencil', exact: true }).click()
    for (const [ax, ay, bx, by] of [[2, 2, 8, 2], [8, 2, 8, 6], [8, 6, 2, 6], [2, 6, 2, 2]]) {
      const box = (await page.locator('.plan-canvas').boundingBox())!
      await page.mouse.move(box.x + box.width * ax / 10, box.y + box.height * ay / 8)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * bx / 10, box.y + box.height * by / 8, { steps: 8 })
      await page.mouse.up()
    }
    await expect(page.locator('button.room')).toHaveCount(1)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await page.locator('button.room').click()
    await clickAction(page, 'Furniture Catalog')
    await page.getByRole('button', { name: /Add Velvet sofa/ }).click()
    await expect.poll(async () => (await saved(page)).furniture?.length).toBe(1)
    const before = await saved(page), original = before.furniture[0]
    expect(furniturePlacementIssues(before, original)).toEqual([])
    expect(original).toMatchObject({ assetId: 'glam-velvet-sofa', wM: 2.19, dM: 1.02 })
    await spatial(page)
    await page.getByRole('button', { name: 'Top-Down', exact: true }).click()
    const handle = page.getByRole('button', { name: 'Drag selected furniture on the floor', exact: true })
    const box = (await handle.boundingBox())!
    const shadowDraws = () => page.evaluate(() => (window as Window & { furnishingShadowDraws?: number }).furnishingShadowDraws ?? 0)
    await expect.poll(shadowDraws).toBeGreaterThan(0)
    const cachedShadows = await shadowDraws()
    // Grab the actual footprint beyond the HTML handle, proving mesh hit testing.
    await page.mouse.move(box.x + box.width + 5, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width + 40, box.y + box.height / 2 - 15, { steps: 8 })
    await page.mouse.up()
    await expect.poll(async () => (await saved(page)).furniture[0].x).not.toBe(original.x)
    const moved = (await saved(page)).furniture[0]
    await expect.poll(shadowDraws).toBeGreaterThan(cachedShadows)
    expect(moved).toMatchObject({ wM: 2.19, dM: 1.02, assetId: original.assetId, rotated: original.rotated })
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect.poll(async () => (await saved(page)).furniture[0]).toEqual(original)
    await page.getByRole('button', { name: 'Rotate furniture', exact: true }).click()
    await expect.poll(async () => (await saved(page)).furniture[0].rotated).toBe(!original.rotated)
    await page.getByRole('button', { name: 'Duplicate furniture', exact: true }).click()
    await expect.poll(async () => (await saved(page)).furniture.length).toBe(2)
    const duplicated = await saved(page)
    expect(furniturePlacementIssues(duplicated, duplicated.furniture[1])).toEqual([])
    expect(duplicated.furniture[1]).toMatchObject({ wM: 2.19, dM: 1.02, assetId: original.assetId })
    await clickAction(page, 'Share')
    const url = await page.evaluate(() => navigator.clipboard.readText())
    expect(decodePlanFromHash(new URL(url).hash)!.furniture).toEqual(duplicated.furniture)
    await page.reload()
    await expect.poll(async () => (await saved(page)).furniture).toEqual(duplicated.furniture)
    expect(errors).toEqual([])
    expect(ai).toEqual([])
  })

  test('a cancelled floor drag does not save or consume an Undo step', async ({ page }) => {
    await addSofa(page); await spatial(page)
    const before = await saved(page)
    const box = (await page.getByRole('button', { name: 'Drag selected furniture on the floor', exact: true }).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 5 })
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })))
    await page.mouse.up()
    expect(await saved(page)).toEqual(before)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect.poll(async () => (await saved(page)).furniture.length).toBe(0)
  })

  test('a selected room that cannot fit the piece refuses it visibly without changing the drawing', async ({ page }) => {
    const tiny = { ...fixture, rooms: [{ ...fixture.rooms[0], w: 5, h: 5 }] }
    await page.goto('/#plan=' + encodePlanToHash(tiny))
    await page.getByRole('button', { name: /^Select Drawn room/ }).click()
    await expect.poll(async () => (await saved(page)).rooms?.[0]?.id).toBe('drawn')
    const before = await saved(page)
    await clickAction(page, 'Furniture Catalog')
    await page.getByRole('button', { name: /Add Velvet sofa/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Could not find clear space' })).toBeVisible()
    expect(await saved(page)).toEqual(before)
  })

  test('furniture edits and selection-row resizing keep a manually chosen camera angle', async ({ page }) => {
    await addSofa(page); await spatial(page)
    await page.getByRole('button', { name: '3D Orbit', exact: true }).click()
    const canvas = page.locator('.spatial-model canvas'), box = (await canvas.boundingBox())!
    await page.mouse.move(box.x + box.width * .15, box.y + box.height * .2)
    await page.mouse.down(); await page.mouse.move(box.x + box.width * .15 + 65, box.y + box.height * .2 + 15, { steps: 8 }); await page.mouse.up()
    // Save must settle pending orbit inertia itself, including on slow GPUs.
    // Waiting for idle first would avoid exercising that capture guarantee.
    const before = await captureCamera(page, 'Before furnishing edit')
    await page.getByRole('button', { name: 'Rotate furniture', exact: true }).click()
    await page.getByLabel('Furniture in 3D', { exact: true }).selectOption('')
    const after = await captureCamera(page, 'After furnishing edit')
    for (let n = 0; n < 3; n++) expect(after.position[n]).toBeCloseTo(before.position[n], 3)
    expect(after.target).toEqual(before.target)
    expect(after.fov).toBe(before.fov)
  })

  test('furnishing controls stay outside the model and usable at all three widths and palettes', async ({ page }) => {
    await addSofa(page); await spatial(page)
    const id = (await saved(page)).furniture[0].id
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
      for (const theme of ['drafting-room', 'solar-pop', 'guava-club', 'violet-hour']) {
        await chooseTheme(page, theme)
        await page.getByLabel('Furniture in 3D', { exact: true }).selectOption(id)
        const canvas = (await page.locator('.spatial-model canvas').boundingBox())!
        const tools = (await page.getByLabel('Furniture editing', { exact: true }).boundingBox())!
        expect(tools.y).toBeGreaterThanOrEqual(canvas.y + canvas.height - 1)
        expect(canvas.height).toBeGreaterThanOrEqual(239)
        // R3F can leave a perfectly sized canvas with a pixel-sized orthographic
        // frustum: then every solid shrinks to a speck. Measure painted content.
        await expect.poll(() => page.locator('.spatial-model canvas').evaluate(canvas => {
          const source = canvas as HTMLCanvasElement, sample = document.createElement('canvas')
          sample.width = source.width; sample.height = source.height
          const ctx = sample.getContext('2d')!
          ctx.drawImage(source, 0, 0)
          const pixels = ctx.getImageData(0, 0, sample.width, sample.height).data
          // Compare actual pixels, so a stale frame from another palette cannot
          // masquerade as painted geometry merely by differing from new CSS.
          const background = pixels.slice(0, 4)
          let ink = 0, total = 0
          for (let n = 0; n < pixels.length; n += 16) { total++; if (Math.max(Math.abs(pixels[n] - background[0]), Math.abs(pixels[n + 1] - background[1]), Math.abs(pixels[n + 2] - background[2])) > 12) ink++ }
          return ink / total
        }), { timeout: 30_000 }).toBeGreaterThan(.01)
        const wrap = (await page.locator('.spatial-wrap').boundingBox())!
        const dock = (await page.locator('.canvas-frame > .science-dock').boundingBox())!
        expect(dock.y, 'sun controls follow the full 3D content without covering its actions or notes').toBeGreaterThanOrEqual(wrap.y + wrap.height - 1)
        for (const label of ['Rotate furniture', 'Duplicate furniture', 'Remove furniture']) {
          const button = page.getByRole('button', { name: label, exact: true })
          const b = (await button.boundingBox())!
          expect(b.height).toBeGreaterThanOrEqual(32)
          expect(b.x + b.width).toBeLessThanOrEqual(width)
          await expect(button).toBeEnabled()
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        await page.screenshot({ path: test.info().outputPath(`furnishing-${width}-${theme}.png`), fullPage: true })
      }
    }
    const piece = (await saved(page)).furniture[0], rect = furnitureRectFor(piece, fixture.site!)
    expect(rect.w * fixture.site!.w / 100).toBeCloseTo(2.19)
  })
})
