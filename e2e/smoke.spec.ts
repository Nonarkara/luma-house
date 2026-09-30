import { test, expect, type Page } from '@playwright/test'
import { encodePlanToHash } from '../src/sharePlan'
import { initialPlan } from '../src/plan'

/**
 * Shipability smoke — covers the three regressions the audit found at c250c32
 * that the 284-test vitest suite could not catch.
 *
 * 1. Share link survives arrival — the welcome gate does NOT cover the
 *    loaded plan, and the plan still has its rooms after the load.
 * 2. Share button is reachable from the top bar.
 * 3. Phone viewport still has Share / New sketch / Furniture Catalog in
 *    the DOM and they are reachable (the audit found `.top-actions
 *    .button.secondary` was hidden under 1180px).
 */

const SAMPLE_PLAN_HASH = encodePlanToHash(initialPlan)

/**
 * Welcome gate renders at z-index 80 and sits on top of the topbar. Without
 * a share-link hash it shows on first load. Pre-seed the storage key the
 * `readWelcomeDismissed()` helper reads (`luma-journey:welcome:shanghai-50`)
 * so the gate stays closed during tests that exercise the top bar.
 */
async function dismissWelcome(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1')
  })
}

async function readRoomCount(page: Page): Promise<number> {
  // FloorPlan renders one <button class="room" aria-label="…, N.N square meters">
  // per room. That's the canonical element we can assert on without coupling
  // to internal SVG/HTML choices.
  return page.evaluate(() => document.querySelectorAll('button.room').length)
}

test.describe('shipability smoke', () => {
  test('share link loads the plan without the welcome gate covering it', async ({ page }) => {
    await page.goto(`/#plan=${SAMPLE_PLAN_HASH}`)
    // Welcome gate must not be visible — bug #2 was z-index 80 covering every control
    await expect(page.locator('.welcome-gate')).toHaveCount(0)
    // Plan rooms must be on the canvas (initial sample = 6 rooms)
    const roomCount = await readRoomCount(page)
    expect(roomCount, 'rooms rendered from the share-link payload').toBe(initialPlan.rooms.length)
  })

  test('Share button is wired and reachable', async ({ page }) => {
    await dismissWelcome(page)
    await page.goto('/')
    const share = page.getByRole('button', { name: 'Share' })
    await expect(share).toBeVisible()
    await expect(share).toBeEnabled()
    // Trial click — proves the element is at the top of the stacking order
    // (no overlay catching the click). We don't fire the real click because
    // `navigator.clipboard.writeText` is permission-gated in headless.
    await share.click({ trial: true })
  })

  test('mobile viewport keeps Share / New sketch / Furniture Catalog reachable', async ({ page }) => {
    await dismissWelcome(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    // These three were hidden by the @media(max-width:1180px) rule that ate
    // `.top-actions .button.secondary`. The fix made them icon-only with
    // aria-label intact, so `getByRole('button', { name: ... })` resolves.
    for (const label of ['Share', 'New sketch', 'Furniture Catalog']) {
      const button = page.getByRole('button', { name: label })
      await expect(button, `${label} must be in the DOM on mobile`).toHaveCount(1)
      await expect(button, `${label} must be visible on mobile`).toBeVisible()
      await button.click({ trial: true })
    }
  })

  test('mobile viewport does not horizontally overflow (8 px tolerance)', async ({ page }) => {
    await dismissWelcome(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    // 8 px tolerance covers sub-pixel rounding + small chrome elements that
    // exceed the viewport on a single axis (scrollbar reservation, etc.).
    // The audit verified "zero horizontal overflow at 390px"; this guard
    // trips if a real layout regression adds meaningful scroll.
    expect(overflow.scrollWidth, 'no horizontal scroll at 390px').toBeLessThanOrEqual(overflow.clientWidth + 8)
  })
})
