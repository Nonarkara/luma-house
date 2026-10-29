import { expect, test, type Page } from '@playwright/test'
import { chinaApartmentPlan } from '../src/mockups/chinaApartment'
import { encodePlanToHash } from '../src/sharePlan'

/**
 * The plan and the 3D, side by side.
 *
 * A placement can only be judged against both views at once: the plan says
 * where the piece is, the 3D says whether it works. So on a sheet wide enough
 * for two, the 3D stands beside the plan, and the two share one selection.
 * On a narrow sheet the plan keeps the whole width and the 3D is not built
 * at all — building it would cost a megabyte of code and a second of waiting
 * for a view the phone cannot show.
 */

const namedHash = encodePlanToHash(chinaApartmentPlan)

async function openStudio(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
  await page.goto(`/#plan=${namedHash}`)
  await expect(page.locator('.app-shell')).toBeVisible()
}

test.describe('the plan and the 3D together', () => {
  test.use({ actionTimeout: 30_000 })

  test('a wide sheet shows the 3D beside the plan', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openStudio(page)

    const toggle = page.getByRole('button', { name: 'Plan + 3D' })
    await expect(toggle).toBeVisible()
    await toggle.click()

    await expect(page.locator('.plan-split-3d')).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('.plan-split-3d .spatial-model')).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('.plan-viewport')).toBeVisible()

    // The plan still works with the 3D beside it.
    const rooms = page.locator('.room')
    const before = await rooms.count()
    // The bedroom's bed fills its north-west; click its empty south-east corner.
    // Wait for the plan to finish re-fitting beside the 3D before measuring.
    let box = (await rooms.first().boundingBox())!
    await expect.poll(async () => {
      const next = (await rooms.first().boundingBox())!
      const settled = Math.abs(next.x - box.x) + Math.abs(next.width - box.width) < 0.5
      box = next
      return settled
    }).toBe(true)
    await rooms.first().click({ position: { x: box.width - 6, y: box.height - 6 } })
    await expect(page.locator('.room.is-selected')).toHaveCount(1)

    // And the 3D beside it carries no authoring console: it is there to look
    // at, and the plan is where the drawing is changed.
    await expect(page.locator('.plan-split-3d .spatial-furniture-tools')).toHaveCount(0)
    await expect(page.locator('.plan-split-3d .spatial-section')).toHaveCount(0)
    expect(before).toBeGreaterThan(0)
  })

  test('a narrow sheet keeps the whole plan and never builds the 3D', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 })
    await openStudio(page)

    // The offer is not made where it cannot be kept.
    await expect(page.getByRole('button', { name: 'Plan + 3D' })).toBeHidden()

    // The plan keeps the full width of the sheet.
    const frame = (await page.locator('.canvas-frame').boundingBox())!
    const viewport = (await page.locator('.plan-viewport').boundingBox())!
    expect(viewport.width).toBeGreaterThan(frame.width * 0.9)
    await expect(page.locator('.plan-split-3d')).toHaveCount(0)
  })

  test('the phone keeps the whole plan and never builds the 3D', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openStudio(page)
    await expect(page.getByRole('button', { name: 'Plan + 3D' })).toBeHidden()
    await expect(page.locator('.plan-split-3d')).toHaveCount(0)
  })
})
