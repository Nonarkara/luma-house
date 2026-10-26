import { expect, test, type Page } from '@playwright/test'
import { encodePlanToHash, decodePlanFromHash } from '../src/sharePlan'
import { initialPlan, furnitureRectFor } from '../src/plan'
import { CHINA_PROJECT_KEY } from '../src/mockups/chinaApartment'
import { themes } from '../src/design/themes'
import { furnitureAssetById } from '../src/catalog/furnitureAssets'
import type { PlanState } from '../src/types'
import { chooseTheme, clickAction } from './workspace'

const fixture: PlanState = { ...initialPlan, site: { w: 10, h: 8, unit: 1 }, rooms: [{ id: 'room', name: 'Living', kind: 'living', x: 10, y: 10, w: 80, h: 80 }], openings: [], furniture: [{ id: 'original', kind: 'sofa', label: 'Velvet sofa', assetId: 'glam-velvet-sofa', wM: 2.19, dM: 1.02, x: 35, y: 35, rotated: false }] }
const saved = (page: Page): Promise<PlanState> => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), CHINA_PROJECT_KEY)
async function load(page: Page, plan = fixture) {
  await page.goto('/#plan=' + encodePlanToHash(plan))
  await expect.poll(async () => (await saved(page)).furniture?.[0]?.id).toBe(plan.furniture[0]?.id)
}
async function replace(page: Page) {
  await page.getByRole('button', { name: 'Spatial', exact: true }).click()
  await page.getByLabel('Furniture in 3D', { exact: true }).selectOption('original')
  await page.getByRole('button', { name: 'Replace furniture', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Solid', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('complementary', { name: 'Furniture catalog' })).toBeVisible()
}

test.describe('try another real-sized product', () => {
  test.describe.configure({ timeout: 180_000 })
  test('preview is inert, cancel restores, Apply is one shared undoable edit', async ({ page }) => {
    const errors: string[] = [], ai: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (/\/(trace|render)$/.test(new URL(request.url()).pathname)) ai.push(request.url()) })
    await load(page)
    const before = await saved(page)
    await replace(page)
    await page.getByRole('button', { name: /^Try Wood and leather sofa/ }).click()
    await expect(page.getByText('Replacement preview only.', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save view PNG', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Saved views', exact: true })).toBeDisabled()
    expect(await saved(page)).toEqual(before)
    await page.getByRole('button', { name: 'Inspect in 3D', exact: true }).click()
    await expect(page.locator('.furniture-catalog-drawer')).toHaveClass(/is-inspecting/)
    await page.getByRole('button', { name: 'Top-Down', exact: true }).click()
    await expect(page.locator('.spatial3d-shell')).toHaveAttribute('data-projection', 'orthographic')
    await page.getByRole('button', { name: 'Top-Down', exact: true }).press('ArrowRight')
    await page.getByRole('button', { name: 'Top-Down', exact: true }).press('Delete')
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
    expect(await saved(page)).toEqual(before)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Save view PNG', exact: true })).toBeEnabled()
    expect(await saved(page)).toEqual(before)
    await expect(page.getByRole('button', { name: 'Replace furniture', exact: true })).toBeFocused()
    await page.getByRole('button', { name: 'Replace furniture', exact: true }).click()
    await page.getByRole('button', { name: /^Try Wood and leather sofa/ }).click()
    await page.getByRole('button', { name: 'Apply replacement', exact: true }).click()
    await expect.poll(async () => (await saved(page)).furniture[0].assetId).toBe('wood-leather-sofa')
    const after = await saved(page), mesh = furnitureAssetById('wood-leather-sofa')!
    expect(after.furniture).toHaveLength(1)
    expect(after.furniture[0]).toMatchObject({ id: 'original', wM: mesh.widthM, dM: mesh.depthM, rotated: false })
    expect({ ...after, furniture: before.furniture }).toEqual(before)
    const a = furnitureRectFor(before.furniture[0], before.site!), b = furnitureRectFor(after.furniture[0], after.site!)
    expect(b.x + b.w / 2).toBeCloseTo(a.x + a.w / 2)
    expect(b.y + b.h / 2).toBeCloseTo(a.y + a.h / 2)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect.poll(() => saved(page)).toEqual(before)
    await page.getByRole('button', { name: 'Redo', exact: true }).click()
    await expect.poll(() => saved(page)).toEqual(after)
    await clickAction(page, 'Share')
    expect(decodePlanFromHash(new URL(page.url()).hash)?.furniture).toEqual(after.furniture)
    await page.reload()
    await expect.poll(() => saved(page)).toEqual(after)
    expect(errors).toEqual([]); expect(ai).toEqual([])
  })

  test('refused trials and Escape do not mutate the drawing or history', async ({ page }) => {
    const narrow: PlanState = { ...fixture, rooms: [{ ...fixture.rooms[0], x: 35, w: 24 }], furniture: [{ ...fixture.furniture[0], x: 35.5 }] }
    await load(page, narrow)
    const before = await saved(page)
    await replace(page)
    await page.getByRole('button', { name: /^Try L-Shape Sectional/ }).click()
    await expect(page.getByRole('alert')).toContainText('wall')
    await expect(page.getByRole('button', { name: 'Apply replacement', exact: true })).toBeDisabled()
    expect(await saved(page)).toEqual(before)
    await page.getByLabel('Fits here only', { exact: true }).check()
    await expect(page.getByRole('button', { name: /^Try L-Shape Sectional/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Close catalog', exact: true }).press('Escape')
    await expect(page.getByRole('complementary', { name: 'Furniture catalog' })).toHaveCount(0)
    expect(await saved(page)).toEqual(before)
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Replace furniture', exact: true }).click()
    await page.getByRole('button', { name: /^Try Sheen chair/ }).click()
    await page.getByRole('button', { name: 'Plan', exact: true }).click()
    await expect(page.getByRole('complementary', { name: 'Furniture catalog' })).toHaveCount(0)
    expect(await saved(page)).toEqual(before)
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  })

  test('a room can be chosen inside the catalogue without returning to Plan', async ({ page }) => {
    const plan: PlanState = { ...fixture, rooms: [{ id: 'tiny', name: 'Store', kind: 'studio', x: 1, y: 1, w: 5, h: 5 }, { ...fixture.rooms[0], id: 'large', name: 'Large room' }] }
    await load(page, plan)
    await page.getByRole('button', { name: 'Spatial', exact: true }).click()
    await page.getByRole('button', { name: 'Add furniture', exact: true }).click()
    await page.getByLabel('Place in room', { exact: true }).selectOption('tiny')
    await page.getByLabel('Fits room only', { exact: true }).check()
    await expect(page.getByRole('button', { name: /^Add Velvet sofa/ })).toHaveCount(0)
    await page.getByLabel('Place in room', { exact: true }).selectOption('large')
    await page.getByRole('button', { name: /^Add Velvet sofa/ }).click()
    await expect.poll(async () => (await saved(page)).furniture.length).toBe(2)
    const placed = (await saved(page)).furniture[1], rect = furnitureRectFor(placed, plan.site!)
    expect(rect.x).toBeGreaterThan(10); expect(rect.y).toBeGreaterThan(10)
    expect(rect.x + rect.w).toBeLessThan(90); expect(rect.y + rect.h).toBeLessThan(90)
  })

  test('catalogue choices and inspection controls fit all widths and palettes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one responsive sweep covers both projects')
    await load(page)
    for (const width of [1440, 1024, 390]) for (const theme of themes) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
      await chooseTheme(page, theme.id)
      await replace(page)
      const drawer = page.locator('.furniture-catalog-drawer'), bounds = (await drawer.boundingBox())!
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1)
      expect(bounds.y + bounds.height).toBeLessThanOrEqual((page.viewportSize()?.height ?? 900) + 1)
      await page.getByRole('button', { name: /^Try Wood and leather sofa/ }).click()
      await page.getByRole('button', { name: 'Inspect in 3D', exact: true }).click()
      for (const name of ['Back to choices', 'Apply replacement', 'Cancel']) {
        const button = page.getByRole('button', { name, exact: true }), r = (await button.boundingBox())!
        expect(r.height).toBeGreaterThanOrEqual(32); expect(r.x + r.width).toBeLessThanOrEqual(width + 1)
        expect(await button.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) })).toBe(true)
      }
      const dock = (await page.locator('.spatial-bottom > .science-dock').boundingBox())!
      const actions = (await page.locator('.spatial-trial-controls').boundingBox())!
      expect(actions.y + actions.height).toBeLessThanOrEqual(dock.y + 1)
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    }
  })
})
