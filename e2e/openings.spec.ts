import { expect, test, type Page } from '@playwright/test'
import { chinaApartmentPlan } from '../src/mockups/chinaApartment'
import { encodePlanToHash } from '../src/sharePlan'

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
