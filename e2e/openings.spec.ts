import { expect, test, type Page } from '@playwright/test'
import { chinaApartmentPlan } from '../src/mockups/chinaApartment'
import { encodePlanToHash } from '../src/sharePlan'
import { CHINA_PROJECT_KEY } from '../src/mockups/chinaApartment'

/**
 * The Window and Door tools.
 *
 * The napkin vocabulary says a short tick on a wall is a door or a window,
 * and the tools exist to place one where you click. The tool path was never
 * tested, and it was dead: a pointer that had merely *moved* was treated as
 * a drag, so the click that should have placed an opening was swallowed. The
 * tool said "click a wall to place a window" and nothing happened.
 *
 * These gates drive the real gesture: pick the tool, move the mouse to a
 * wall, click it. The placement is then checked against the wall it landed
 * on, not merely counted.
 */

const namedHash = encodePlanToHash(chinaApartmentPlan)

async function openStudio(page: Page, width: number, height = 900) {
  await page.addInitScript(() => window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
  await page.setViewportSize({ width, height })
  await page.goto(`/#plan=${namedHash}`)
  await expect(page.locator('.app-shell')).toBeVisible()
}

/** The room's rectangle, in the percentages the plan itself uses. */
async function roomRect(page: Page, index: number) {
  return page.locator('.room').nth(index).evaluate(el => {
    const style = (el as HTMLElement).style
    return {
      x: parseFloat(style.left), y: parseFloat(style.top),
      w: parseFloat(style.width), h: parseFloat(style.height),
      box: el.getBoundingClientRect().toJSON(),
    }
  })
}

test.describe('the opening tools', () => {
  test('wall hosting keeps the full aperture inside the wall and refuses empty floor', async ({ page }) => {
    const plan = { ...chinaApartmentPlan, site: { w: 10, h: 10, unit: 1 }, rooms: [{ id: 'host', name: 'Host room', kind: 'living' as const, x: 20, y: 20, w: 40, h: 40 }], openings: [], furniture: [] }
    await page.goto('/#plan=' + encodePlanToHash(plan))
    const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), CHINA_PROJECT_KEY)
    await expect.poll(async () => (await read()).rooms?.[0]?.id).toBe('host')
    const stage = (await page.locator('.plan-canvas').boundingBox())!
    const clickAt = (x: number, y: number) => page.mouse.click(stage.x + stage.width * x / 100, stage.y + stage.height * y / 100)
    await page.getByRole('button', { name: 'Window', exact: true }).click()
    await clickAt(20.2, 20)
    await expect.poll(async () => (await read()).openings?.length).toBe(1)
    const placed = (await read()).openings[0]
    expect(placed).toMatchObject({ x: 28, y: 20, rotation: 0 })
    await page.getByRole('button', { name: 'Window', exact: true }).click()
    await clickAt(40, 40)
    await expect(page.locator('.toast')).toContainText('nearby wall long enough')
    expect((await read()).openings).toHaveLength(1)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect.poll(async () => (await read()).openings?.length).toBe(0)
    await page.getByRole('button', { name: 'Redo', exact: true }).click()
    await expect.poll(async () => (await read()).openings?.[0]?.x).toBe(28)
  })

  test('a window is placed on the wall you click', async ({ page }) => {
    await openStudio(page, 1440)
    const before = await page.locator('.opening-window').count()
    await page.getByRole('button', { name: 'Window', exact: true }).click()
    await expect(page.locator('.draw-hint')).toContainText('place a window')

    const room = await roomRect(page, 0)
    // The wall is the room's edge. Click the middle of its top edge.
    await page.mouse.click(room.box.x + room.box.width / 2, room.box.y + 1)

    await expect(page.locator('.opening-window')).toHaveCount(before + 1)
    const placed = await page.locator('.opening-window').last().evaluate(el => {
      const style = (el as HTMLElement).style
      return { x: parseFloat(style.left), y: parseFloat(style.top) }
    })
    // It must sit on the wall that was clicked, not float in the room.
    expect(Math.abs(placed.y - room.y), 'the window is on the top wall').toBeLessThan(1)
    expect(Math.abs(placed.x - (room.x + room.w / 2)), 'the window is where it was clicked').toBeLessThan(2)
  })

  test('a door is placed on the wall you click', async ({ page }) => {
    await openStudio(page, 1440)
    const before = await page.locator('.opening-door').count()
    await page.getByRole('button', { name: 'Door', exact: true }).click()
    await expect(page.locator('.draw-hint')).toContainText('place a door')

    const room = await roomRect(page, 0)
    // The left wall, so the opening is vertical.
    await page.mouse.click(room.box.x + 1, room.box.y + room.box.height / 2)

    await expect(page.locator('.opening-door')).toHaveCount(before + 1)
    const placed = await page.locator('.opening-door').last().evaluate(el => {
      const style = (el as HTMLElement).style
      return { x: parseFloat(style.left), y: parseFloat(style.top) }
    })
    expect(Math.abs(placed.x - room.x), 'the door is on the left wall').toBeLessThan(1)
    expect(Math.abs(placed.y - (room.y + room.h / 2)), 'the door is where it was clicked').toBeLessThan(2)
  })

  test('a click still works after the drawing has been panned', async ({ page }) => {
    // A drag on the canvas is a pan. It must not make the next click look like
    // a drag too, or the tools go quiet exactly when the user is working.
    await openStudio(page, 1440)
    const canvas = await page.locator('.plan-canvas').boundingBox()
    await page.mouse.move(canvas!.x + canvas!.width / 2, canvas!.y + canvas!.height / 2)
    await page.mouse.down()
    await page.mouse.move(canvas!.x + canvas!.width / 2 + 40, canvas!.y + canvas!.height / 2 + 20, { steps: 6 })
    await page.mouse.up()

    const before = await page.locator('.opening-window').count()
    await page.getByRole('button', { name: 'Window', exact: true }).click()
    const room = await roomRect(page, 0)
    await page.mouse.click(room.box.x + room.box.width / 2, room.box.y + 1)
    await expect(page.locator('.opening-window')).toHaveCount(before + 1)
  })

  test('the tool says so, and the click is confirmed', async ({ page }) => {
    await openStudio(page, 1440)
    await page.getByRole('button', { name: 'Window', exact: true }).click()
    const room = await roomRect(page, 0)
    await page.mouse.click(room.box.x + room.box.width / 2, room.box.y + 1)
    await expect(page.locator('.toast')).toContainText('Window placed')
  })
})
