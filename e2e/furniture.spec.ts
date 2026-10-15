import { expect, test, type Page } from '@playwright/test'
import { encodePlanToHash } from '../src/sharePlan'
import { initialPlan } from '../src/plan'
import { openMore } from './workspace'

const hash = encodePlanToHash(initialPlan)

/**
 * Index count of the largest single draw call since page load.
 *
 * This is how the test tells a real mesh from its fallback. A `boxGeometry` is
 * exactly 36 indices, and every surface the rest of the building draws is a box
 * too, so anything above BOX_INDICES can only have come from a GLB mesh. Without
 * this, both the Suspense fallback and the error boundary draw a perfectly
 * visible box — a total decode failure would pass every other assertion in this
 * file while showing the user nothing but grey rectangles.
 */
const BOX_INDICES = 36
const MESH_INDICES = 1000

function trackDrawCalls(page: Page) {
  return page.addInitScript(() => {
    const target = window as Window & { largestDraw?: number; shadowMeshDraws?: number }
    const bound = new WeakMap<WebGL2RenderingContext, boolean>()
    const bind = WebGL2RenderingContext.prototype.bindFramebuffer
    WebGL2RenderingContext.prototype.bindFramebuffer = function (type, buffer) {
      if (type === this.FRAMEBUFFER || type === this.DRAW_FRAMEBUFFER) bound.set(this, buffer !== null)
      return bind.call(this, type, buffer)
    }
    const original = WebGL2RenderingContext.prototype.drawElements
    // Count only; application behaviour is untouched.
    WebGL2RenderingContext.prototype.drawElements = function (
      mode: number, count: number, type: number, offset: number,
    ) {
      if (bound.get(this) && count > 1000) target.shadowMeshDraws = (target.shadowMeshDraws ?? 0) + 1
      target.largestDraw = Math.max(target.largestDraw ?? 0, count)
      return original.call(this, mode, count, type, offset)
    }
  })
}

const largestDraw = (page: Page) =>
  page.evaluate(() => (window as Window & { largestDraw?: number; shadowMeshDraws?: number }).largestDraw ?? 0)

async function placeVelvetSofa(page: Page) {
  await page.addInitScript(() => localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
  await page.goto(`/#plan=${hash}`)
  await openMore(page)
  await page.getByRole('button', { name: 'Furniture Catalog', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Furniture catalog' })).toBeVisible()
  await page.getByRole('button', { name: /Add Velvet sofa/ }).click()
  await expect(page.locator('.furniture-chip')).toContainText('Velvet sofa')
}

async function openSolidView(page: Page) {
  await page.getByRole('button', { name: 'Spatial', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Solid', exact: true })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Solid', exact: true }).click()
  await expect(page.locator('.spatial3d-shell canvas')).toBeVisible()
}

test.describe('measured furniture in local 3D', () => {
  // These tests are the only ones that make the software renderer compile a real
  // PBR mesh. In isolation they take ~10 s, but after their siblings the same
  // work has exceeded the 60 s default while the page stayed visibly correct.
  // The budget reflects the work, not a flake tolerance.
  test.describe.configure({ timeout: 180_000 })

  test('preserves the selected asset and lazy-loads it only in Solid view', async ({ page }) => {
    await placeVelvetSofa(page)
    await expect.poll(() => page.evaluate(() => {
      const raw = localStorage.getItem('designon:plan:south-light-shanghai-50:v4')
      return raw ? JSON.parse(raw).furniture?.at(-1)?.assetId : null
    })).toBe('glam-velvet-sofa')
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('designon:plan:south-light-shanghai-50:v4')!))
    expect(stored.furniture.at(-1)).toMatchObject({
      kind: 'sofa',
      label: 'Velvet sofa',
      assetId: 'glam-velvet-sofa',
      wM: 2.19,
      dM: 1.02,
    })

    const request = page.waitForResponse(response =>
      response.url().endsWith('/furniture/models/glam-velvet-sofa.glb') && response.status() === 200,
    )
    await page.getByRole('button', { name: 'Spatial', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Solid', exact: true })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Solid', exact: true }).click()
    await request
    await expect(page.locator('.spatial3d-shell canvas')).toBeVisible()
  })

  test('actually draws the mesh geometry, not just its fallback box', async ({ page }) => {
    await trackDrawCalls(page)
    await placeVelvetSofa(page)
    await openSolidView(page)
    // The load and the draw are separate events: a 200 proves the bytes arrived,
    // this proves something other than a 36-index box reached the GPU.
    await expect.poll(() => largestDraw(page), { timeout: 30_000 }).toBeGreaterThan(MESH_INDICES)
  })

  test('a missing model falls back without taking down the building', async ({ page }) => {
    await page.route('**/furniture/models/glam-velvet-sofa.glb', route => route.abort())
    await placeVelvetSofa(page)
    await page.getByRole('button', { name: 'Spatial', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Solid', exact: true })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Solid', exact: true }).click()
    await expect(page.getByRole('button', { name: '3D Orbit', exact: true })).toBeVisible()
    await expect(page.locator('.spatial3d-shell canvas')).toBeVisible()
  })

  test('an unavailable model leaves measured boxes and explains the fallback', async ({ page }) => {
    await trackDrawCalls(page)
    await page.route('**/furniture/models/glam-velvet-sofa.glb', route => route.abort())
    await placeVelvetSofa(page)
    await openSolidView(page)
    await page.waitForTimeout(2_000)
    await expect(page.locator('.spatial-orbit-note').filter({ hasText: 'measured boxes while' })).toBeVisible()
    // First prove the scene drew at all, so the bound below is meaningful
    // rather than satisfied by an empty canvas.
    expect(await largestDraw(page)).toBeGreaterThanOrEqual(BOX_INDICES)
    // The failure path must be indistinguishable from a box, and must not
    // silently draw something else in its place.
    expect(await largestDraw(page)).toBeLessThan(MESH_INDICES)
  })
})


test('late model geometry enters the cached solar shadow map, which rests again afterwards', async ({ page }) => {
  await trackDrawCalls(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/furniture/models/glam-velvet-sofa.glb', async route => { await gate; await route.continue() })
  await placeVelvetSofa(page)
  await openSolidView(page)
  await expect.poll(() => largestDraw(page)).toBeGreaterThanOrEqual(BOX_INDICES)
  expect(await page.evaluate(() => (window as Window & { shadowMeshDraws?: number }).shadowMeshDraws ?? 0)).toBe(0)
  release()
  const shadows = () => page.evaluate(() => (window as Window & { shadowMeshDraws?: number }).shadowMeshDraws ?? 0)
  await expect.poll(shadows, { timeout: 30000 }).toBeGreaterThan(0)
  // Wait for the final committed frame, then move only the camera. Loaded
  // geometry must cast a real shadow once, without enabling continuous maps.
  await page.waitForTimeout(500)
  const cached = await shadows()
  await page.getByRole('button', { name: 'Top-Down', exact: true }).click()
  await page.waitForTimeout(500)
  expect(await shadows()).toBe(cached)
})

test('a corrupt model with HTTP 200 also falls back without an uncaught page error', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await trackDrawCalls(page)
  await page.route('**/furniture/models/glam-velvet-sofa.glb', route => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: 'corrupt model' }))
  await placeVelvetSofa(page)
  await openSolidView(page)
  await expect.poll(() => largestDraw(page)).toBeGreaterThanOrEqual(BOX_INDICES)
  await page.waitForTimeout(500)
  expect(await largestDraw(page)).toBeLessThan(MESH_INDICES)
  expect(errors).toEqual([])
  await expect(page.locator('.spatial3d-shell canvas')).toBeVisible()
})
