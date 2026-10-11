import { expect, test, type Page } from '@playwright/test'
import { decodePlanFromHash, encodePlanToHash } from '../src/sharePlan'
import { CHINA_PROJECT_KEY, chinaApartmentPlan } from '../src/mockups/chinaApartment'
import type { PlanState } from '../src/types'

const fixture: PlanState = {
  site: { w: 10, h: 8, unit: 1 },
  rooms: [{ id: 'room', name: 'Work / living', kind: 'living', x: 10, y: 10, w: 60, h: 60 }],
  openings: [
    { id: 'door', type: 'door', x: 10, y: 35, rotation: 90, widthM: 1.1 },
    { id: 'window', type: 'window', x: 40, y: 10, rotation: 0, widthM: 2 },
  ],
  furniture: [
    { id: 'desk', kind: 'desk', x: 20, y: 20, rotated: false, wM: 1.6, dM: .8 },
    { id: 'sofa', kind: 'sofa', x: 40, y: 30, rotated: false },
    { id: 'storage', kind: 'wardrobe', x: 60, y: 15, rotated: false, wM: 1.1, dM: .55 },
  ],
  systems: { solar: false, insulation: false, climate: false, lighting: false },
}
const saved = (page: Page): Promise<PlanState> => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), CHINA_PROJECT_KEY)

test('preview is inert; Apply is one undo step, persists and shares without AI', async ({ page }) => {
  const calls: string[] = []
  await page.route('**/luma-concept-render.drnon.workers.dev/**', r => { calls.push(r.request().url()); return r.abort() })
  await page.goto('/#plan=' + encodePlanToHash(fixture))
  await expect.poll(async () => (await saved(page)).furniture?.length).toBe(3)
  const original = await saved(page)
  await expect(page.getByRole('button', { name: 'Desk, 1.6 by 0.8 meters', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Room options', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Room options', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('img')).toHaveCount(2)
  await dialog.getByRole('button', { name: /Window side/ }).click()
  await dialog.getByRole('button', { name: /Along walls/ }).click()
  await dialog.getByRole('button', { name: /Along walls/ }).press('Delete')
  expect(await saved(page)).toEqual(original)
  await dialog.getByRole('button', { name: 'Keep current drawing', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Room options', exact: true }).click()
  await dialog.getByRole('button', { name: 'Apply arrangement', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(async () => JSON.stringify((await saved(page)).furniture)).not.toBe(JSON.stringify(original.furniture))
  const applied = await saved(page)
  const desk = applied.furniture.find(f => f.id === 'desk')!
  await expect(page.getByRole('button', { name: `Desk, ${desk.rotated ? desk.dM : desk.wM} by ${desk.rotated ? desk.wM : desk.dM} meters`, exact: true })).toBeVisible()
  expect(applied.rooms).toEqual(original.rooms)
  expect(applied.openings).toEqual(original.openings)
  expect(applied.furniture.map(f => [f.id, f.kind, f.wM, f.dM])).toEqual(original.furniture.map(f => [f.id, f.kind, f.wM, f.dM]))
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect.poll(() => saved(page)).toEqual(original)
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect.poll(() => saved(page)).toEqual(applied)
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  const url = await page.evaluate(() => navigator.clipboard.readText())
  expect(decodePlanFromHash(new URL(url).hash)?.furniture).toEqual(applied.furniture)
  await page.reload()
  expect((await saved(page)).furniture).toEqual(applied.furniture)
  await page.getByRole('button', { name: 'Spatial', exact: true }).click()
  await expect(page.locator('.spatial3d-shell')).toBeVisible()
  expect(calls).toEqual([])
})

test('empty room and failed search keep Apply disabled; undone room selection falls back', async ({ page }) => {
  await page.goto('/#plan=' + encodePlanToHash({ ...fixture, furniture: [] }))
  await page.getByRole('button', { name: 'Add room', exact: true }).click()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.getByRole('button', { name: 'Room options', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Room options', exact: true })
  await expect(dialog.getByLabel('Room', { exact: true })).toHaveValue('room')
  await expect(dialog.getByRole('status')).toContainText('Add movable furniture')
  await expect(dialog.getByRole('button', { name: 'Apply arrangement', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Close room options', exact: true }).press('Escape')
  await expect(dialog).toHaveCount(0)
  const impossible: PlanState = { ...fixture, rooms: [{ ...fixture.rooms[0], w: 20, h: 20 }], openings: [], furniture: [{ id: 'big', kind: 'bed', x: 10, y: 10, rotated: false, wM: 3, dM: 1.5 }] }
  await page.goto('/#plan=' + encodePlanToHash(impossible))
  // Share payloads are loaded on document entry, not on an in-page hash change.
  await page.reload()
  await page.getByRole('button', { name: 'Room options', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('No alternative found')
  await expect(dialog.getByRole('button', { name: 'Apply arrangement', exact: true })).toBeDisabled()
})

test('A/B comparison names the active city and selected climate assumptions', async ({ page }) => {
  const plan: PlanState = { ...chinaApartmentPlan, location: { name: 'Bangkok', label: 'Bangkok, Thailand', latitude: 13.7563, longitude: 100.5018, timezone: 'Asia/Bangkok' } }
  await page.goto('/#plan=' + encodePlanToHash(plan))
  await page.locator('.journey-step').filter({ hasText: 'Cost' }).click()
  await page.getByRole('button', { name: 'Pin Plan A', exact: true }).click()
  await page.getByRole('button', { name: 'Compare A vs B', exact: true }).click()
  await expect(page.locator('.ab-comparison-context')).toContainText('Bangkok, Thailand')
  await expect(page.locator('.ab-comparison-context')).toContainText('Asia/Bangkok')
  await expect(page.locator('.ab-comparison-context')).toContainText('wind from 180° at 3 m/s')
  await expect(page.locator('.ab-comparison-context')).toContainText('not live weather')
})
