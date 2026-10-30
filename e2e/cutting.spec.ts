import { expect, test, type Page } from '@playwright/test'
import { CHINA_PROJECT_KEY } from '../src/mockups/chinaApartment'
import { encodePlanToHash } from '../src/sharePlan'
import type { PlanState, Room } from '../src/types'

/**
 * Cutting a drawing: the eraser, the trim, and carrying a piece in.
 *
 * The napkin vocabulary gave the plan a line, a tick and a box. What it did
 * not give it was the other half of editing — taking a wall out without
 * taking the room with it, and putting a window where the finger is rather
 * than where the pointer happens to be. These gates own that behaviour: they
 * drive the real interface and read what it wrote.
 */

function planWith(rooms: Room[], extra: Partial<PlanState> = {}): PlanState {
  return {
    rooms,
    openings: [],
    furniture: [],
    walls: [],
    systems: { solar: false, insulation: false, climate: false, lighting: false },
    site: { w: 10, h: 10, unit: 1 },
    ...extra,
  }
}

const host: Room = { id: 'host', name: 'Host room', kind: 'living', x: 20, y: 20, w: 40, h: 40 }

async function openPlan(page: Page, plan: PlanState) {
  await page.addInitScript(() => window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
  await page.goto('/#plan=' + encodePlanToHash(plan))
  await expect(page.locator('.app-shell')).toBeVisible()
  await expect.poll(async () => (await readPlan(page)).rooms?.length).toBe(plan.rooms.length)
}

async function readPlan(page: Page): Promise<PlanState> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), CHINA_PROJECT_KEY)
}

async function stageBox(page: Page) {
  return (await page.locator('.plan-canvas').boundingBox())!
}

async function clickAt(page: Page, x: number, y: number) {
  const stage = await stageBox(page)
  await page.mouse.click(stage.x + (stage.width * x) / 100, stage.y + (stage.height * y) / 100)
}

async function hoverAt(page: Page, x: number, y: number) {
  const stage = await stageBox(page)
  await page.mouse.move(stage.x + (stage.width * x) / 100, stage.y + (stage.height * y) / 100)
}

test.describe('the eraser', () => {
  test('removes the room under the cursor and says which one', async ({ page }) => {
    await openPlan(page, planWith([host]))
    await page.getByRole('button', { name: 'Erase', exact: true }).click()
    await expect(page.locator('.draw-hint')).toContainText('remove a piece')
    await clickAt(page, 40, 40)
    await expect.poll(async () => (await readPlan(page)).rooms?.length).toBe(0)
    await expect(page.locator('.toast')).toContainText('Host room removed')
  })

  test('removes an opening before the room behind it', async ({ page }) => {
    await openPlan(page, planWith([host]))
    await page.getByRole('button', { name: 'Window', exact: true }).click()
    await clickAt(page, 20.2, 20)
    await expect.poll(async () => (await readPlan(page)).openings?.length).toBe(1)

    await page.getByRole('button', { name: 'Erase', exact: true }).click()
    await clickAt(page, 28, 20)
    await expect.poll(async () => (await readPlan(page)).openings?.length).toBe(0)
    // The room it stood on is still there.
    expect((await readPlan(page)).rooms).toHaveLength(1)
  })

  test('undoes the erase', async ({ page }) => {
    await openPlan(page, planWith([host]))
    await page.getByRole('button', { name: 'Erase', exact: true }).click()
    await clickAt(page, 40, 40)
    await expect.poll(async () => (await readPlan(page)).rooms?.length).toBe(0)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect.poll(async () => (await readPlan(page)).rooms?.length).toBe(1)
  })
})

test.describe('the trim', () => {
  test('cuts a crossing room back to the wall it crosses', async ({ page }) => {
    // The new room runs from x=30 to x=100; the old room ends at x=60. The
    // crossing is the 30×30 block they share, so the new room is cut back to
    // the old room's east wall and keeps 40% of the sheet.
    const crossing: Room = { id: 'new', name: 'New room', kind: 'studio', x: 30, y: 30, w: 70, h: 30 }
    await openPlan(page, planWith([host, crossing]))
    await page.getByRole('button', { name: 'Trim', exact: true }).click()
    await expect(page.locator('.draw-hint')).toContainText('crosses another')

    // The band it would take is shown before the click.
    await hoverAt(page, 70, 45)
    await expect(page.locator('.trim-overlay')).toBeVisible()

    await clickAt(page, 70, 45)
    await expect(page.locator('.toast')).toContainText('trimmed')
    // The room is saved a moment after the click, so wait for the save.
    await expect.poll(async () => (await readPlan(page)).rooms?.find(room => room.id === 'new')?.x).toBe(60)
    const trimmed = (await readPlan(page)).rooms.find(room => room.id === 'new')
    expect(trimmed?.w, 'and keeps the rest of its width').toBe(40)
  })

  test('refuses a cut that would leave a sliver, and changes nothing', async ({ page }) => {
    // The new room crosses the old one and only 10% of it would survive the
    // cut, so the trim says so rather than leaving a strip you cannot use.
    const crossing: Room = { id: 'new', name: 'New room', kind: 'studio', x: 30, y: 30, w: 40, h: 30 }
    await openPlan(page, planWith([host, crossing]))
    await page.getByRole('button', { name: 'Trim', exact: true }).click()
    await clickAt(page, 50, 45)
    await expect(page.locator('.toast')).toContainText('too small to use')
    expect((await readPlan(page)).rooms).toHaveLength(2)
  })

  test('says so when there is nothing to trim', async ({ page }) => {
    await openPlan(page, planWith([host]))
    await page.getByRole('button', { name: 'Trim', exact: true }).click()
    await clickAt(page, 40, 40)
    await expect(page.locator('.toast')).toContainText('does not cross another')
    expect((await readPlan(page)).rooms).toHaveLength(1)
  })

  test('the overlap warning offers the tool that fixes it', async ({ page }) => {
    // The app says when two rooms overlap and the floor is counted twice.
    // Now it says what to do about it, in the place where it says it.
    const existing: Room = { id: 'old', name: 'Old room', kind: 'living', x: 10, y: 10, w: 40, h: 40 }
    const crossing: Room = { id: 'new', name: 'New room', kind: 'studio', x: 30, y: 30, w: 70, h: 30 }
    await openPlan(page, planWith([existing, crossing]))

    const warning = page.locator('.overlap-warning')
    await expect(warning).toBeVisible()
    await expect(warning).toContainText('Rooms overlap')

    await page.getByRole('button', { name: 'Trim the overlap' }).click()
    await expect.poll(async () => (await readPlan(page)).rooms?.find(room => room.id === 'new')?.x).toBe(50)
    // And with the overlap gone, the warning goes with it.
    await expect(page.locator('.overlap-warning')).toHaveCount(0)
  })
})

test.describe('carrying a piece in', () => {
  test('a window dragged onto a wall cuts an opening in it', async ({ page }) => {
    await openPlan(page, planWith([host]))
    const stage = await stageBox(page)
    const button = await page.getByRole('button', { name: 'Window', exact: true }).boundingBox()
    const wallX = stage.x + (stage.width * 20) / 100
    const wallY = stage.y + (stage.height * 20) / 100

    await page.mouse.move(button!.x + button!.width / 2, button!.y + button!.height / 2)
    await page.mouse.down()
    await page.mouse.move(wallX, wallY, { steps: 12 })
    // The plan says where it would land before it is let go.
    await expect(page.locator('.opening.is-preview')).toBeVisible()
    await page.mouse.up()

    await expect.poll(async () => (await readPlan(page)).openings?.length).toBe(1)
    const placed = (await readPlan(page)).openings[0]
    expect(Math.abs(placed.y - 20), 'it landed on the wall').toBeLessThan(1.5)
  })

  test('a window let go on empty paper is not placed and says why', async ({ page }) => {
    await openPlan(page, planWith([host]))
    const stage = await stageBox(page)
    const button = await page.getByRole('button', { name: 'Window', exact: true }).boundingBox()

    await page.mouse.move(button!.x + button!.width / 2, button!.y + button!.height / 2)
    await page.mouse.down()
    await page.mouse.move(stage.x + stage.width * 0.9, stage.y + stage.height * 0.9, { steps: 12 })
    await page.mouse.up()

    await expect(page.locator('.toast')).toContainText('wall long enough')
    expect((await readPlan(page)).openings ?? []).toHaveLength(0)
  })
})


test('overlap repair removes a newly unsupported footprint, and Undo/Redo preserves the whole edit', async ({ page }) => {
  const older: Room = { ...host, id: 'old', x: 10, y: 10, w: 40, h: 40 }
  const crossing: Room = { ...host, id: 'new', x: 30, y: 30, w: 40, h: 30 }
  const sofa = { id: 'sofa', kind: 'sofa' as const, x: 46, y: 52, rotated: false, wM: 2, dM: .6 }
  await openPlan(page, planWith([older, crossing], { site: { w: 14, h: 10, unit: 1 }, furniture: [sofa] }))
  await page.getByRole('button', { name: 'Trim the overlap', exact: true }).click()
  await expect.poll(async () => (await readPlan(page)).furniture.length).toBe(0)
  await expect(page.locator('.toast')).toContainText('1 piece of furniture removed')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect.poll(async () => (await readPlan(page)).furniture).toEqual([sofa])
  await expect.poll(async () => (await readPlan(page)).rooms.find(room => room.id === 'new')?.x).toBe(30)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect.poll(async () => (await readPlan(page)).furniture.length).toBe(0)
  await expect.poll(async () => (await readPlan(page)).rooms.find(room => room.id === 'new')?.x).toBe(50)
})
