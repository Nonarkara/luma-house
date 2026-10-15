import { expect, test } from '@playwright/test'
import { encodePlanToHash } from '../src/sharePlan'
import { initialPlan } from '../src/plan'
import { CHINA_PROJECT_KEY } from '../src/mockups/chinaApartment'
import type { PlanState } from '../src/types'

for (const over of [.5, .7]) test(`a rough pencil loop with ${over} m overshoot closes without leftover walls`, async ({ page }) => {
  const site = { w: 14, h: 10, unit: 1 }
  const fixture: PlanState = { ...initialPlan, site, rooms: [], walls: [], furniture: [], openings: [] }
  await page.goto('/#plan=' + encodePlanToHash(fixture))
  await page.getByRole('button', { name: 'Pencil', exact: true }).click()
  const stroke = async (ax: number, ay: number, bx: number, by: number) => {
    const sheet = await page.locator('.plan-canvas').boundingBox()
    const point = (x: number, y: number) => ({ x: sheet!.x + sheet!.width * x / site.w, y: sheet!.y + sheet!.height * y / site.h })
    const a = point(ax, ay), b = point(bx, by)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    const inking = await page.locator('.plan-canvas').boundingBox()
    expect(inking!.y).toBeCloseTo(sheet!.y, 1)
    expect(inking!.height).toBeCloseTo(sheet!.height, 1)
    await page.mouse.move(b.x, b.y, { steps: 8 })
    await page.mouse.up()
  }
  await stroke(4 - over, 3, 9 + over, 3)
  await stroke(9, 3 - over, 9, 7 + over)
  await stroke(9 + over, 7, 4 - over, 7)
  await stroke(4, 7 + over, 4, 3 - over)
  await expect(page.locator('button.room')).toHaveCount(1)
  await expect.poll(async () => {
    const result = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}') as PlanState, CHINA_PROJECT_KEY)
    return result.rooms?.length === 1 ? result.walls ?? [] : null
  }).toEqual([])
  await expect(page.locator('.inspector')).toBeHidden()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('button.room')).toHaveCount(0)
})
