import { expect, test } from '@playwright/test'
import { encodePlanToHash } from '../src/sharePlan'
import { initialPlan, furnitureRectFor } from '../src/plan'
import { CHINA_PROJECT_KEY } from '../src/mockups/chinaApartment'
import type { Furniture, PlanState } from '../src/types'

for (const edge of [
  { name: 'east', key: 'ArrowRight', x: 38, y: 40, axis: 'x', limit: 39.25 },
  { name: 'west', key: 'ArrowLeft', x: 21, y: 40, axis: 'x', limit: 20.75 },
  { name: 'north', key: 'ArrowUp', x: 30, y: 21, axis: 'y', limit: 20.9375 },
  { name: 'south', key: 'ArrowDown', x: 30, y: 56, axis: 'y', limit: 56.5625 },
] as const) {
test(`keyboard nudges obey the ${edge.name} room wall, persist, and undo in one step`, async ({ page }) => {
  const site = { w: 10, h: 8, unit: 1 }
  const item: Furniture = { id: 'keyboard-sofa', kind: 'sofa', label: 'Keyboard sofa', wM: 2, dM: 1, x: edge.x, y: edge.y, rotated: false }
  const fixture: PlanState = {
    ...initialPlan, site,
    rooms: [{ id: 'keyboard-room', name: 'Keyboard room', kind: 'studio', x: 20, y: 20, w: 40, h: 50 }],
    openings: [], furniture: [item],
  }
  const saved = (): Promise<PlanState> => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), CHINA_PROJECT_KEY)
  await page.goto('/#plan=' + encodePlanToHash(fixture))
  await expect.poll(async () => (await saved()).furniture?.[0]?.id).toBe(item.id)
  await page.getByRole('button', { name: 'Sofa, 2 by 1 meters', exact: true }).click()
  await page.keyboard.press(`Shift+${edge.key}`)
  await expect.poll(async () => (await saved()).furniture[0][edge.axis]).toBeCloseTo(edge.limit)
  const clamped = (await saved()).furniture[0]
  await page.keyboard.press(`Shift+${edge.key}`)
  await expect.poll(async () => (await saved()).furniture[0]).toEqual(clamped)
  // A refused nudge must not consume another Undo entry.
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(async () => (await saved()).furniture[0]).toEqual(item)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect.poll(async () => (await saved()).furniture[0]).toEqual(clamped)
  await page.reload()
  await expect.poll(async () => (await saved()).furniture[0]).toEqual(clamped)
})
}

for (const piece of [
  { id: 'measured', kind: 'sofa', label: 'Measured sofa', assetId: 'wood-leather-sofa', wM: 2.73, dM: .92 },
  { id: 'custom', kind: 'desk', label: 'Custom desk', wM: 3.4, dM: .7 },
] as const) {
  test(`rotating ${piece.label} preserves its dimensions and fits the site; Undo restores it`, async ({ page }) => {
    const site = { w: 10, h: 10, unit: 1 }
    const item: Furniture = { ...piece, x: (10 - piece.wM) * 10 - .1, y: 90, rotated: false }
    const fixture: PlanState = { ...initialPlan, site, rooms: [{ id: 'studio', name: 'Studio', kind: 'studio', x: 0, y: 0, w: 100, h: 100 }], openings: [], furniture: [item] }
    const saved = (): Promise<PlanState> => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), CHINA_PROJECT_KEY)
    await page.goto('/#plan=' + encodePlanToHash(fixture))
    await expect.poll(async () => (await saved()).furniture?.[0]?.id).toBe(item.id)
    const original = await saved()
    await page.getByRole('button', { name: new RegExp(`, ${piece.wM} by ${piece.dM} meters$`) }).click()
    await page.getByRole('button', { name: 'Rotate furniture', exact: true }).click()
    await expect.poll(async () => (await saved()).furniture[0].rotated).toBe(true)
    const rotated = (await saved()).furniture[0]
    expect(rotated).toMatchObject({ ...piece, rotated: true })
    const rect = furnitureRectFor(rotated, site)
    expect(rect.x).toBeGreaterThanOrEqual(0)
    expect(rect.y).toBeGreaterThanOrEqual(0)
    expect(rect.x + rect.w).toBeLessThanOrEqual(100 + 1e-8)
    expect(rect.y + rect.h).toBeLessThanOrEqual(100 + 1e-8)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect.poll(saved).toEqual(original)
  })
}
