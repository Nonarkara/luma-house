import { expect, test, type Page } from '@playwright/test'
import { chinaApartmentPlan } from '../src/mockups/chinaApartment'
import { encodePlanToHash } from '../src/sharePlan'

/**
 * The chrome of the Renders gallery, measured.
 *
 * The gallery is the one surface that never had a pass: the Plan view was
 * measured on 2026-10-27 and the Spatial view on 2026-10-25, but the gallery
 * carried the whole Spatial console *plus* its own bands and was never
 * counted. It was the worst surface in the product — at 390×844 the picture
 * was 295px against 549px of chrome, and the chrome outweighed the work by
 * nearly two to one.
 *
 * These gates own the numbers that came out of the pass, so a later change
 * cannot quietly take the space back. They measure the rendered page; they do
 * not read the stylesheet.
 */

const namedHash = encodePlanToHash(chinaApartmentPlan)

async function openStudio(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
  await page.goto(`/#plan=${namedHash}`)
  await expect(page.locator('.app-shell')).toBeVisible()
}

async function openGallery(page: Page) {
  await page.getByRole('button', { name: 'Renders', exact: true }).click({ noWaitAfter: true })
  await expect(page.locator('.render-gallery')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.spatial-model')).toBeVisible({ timeout: 60_000 })
  await page.waitForTimeout(2500)
}

interface Gallery {
  viewH: number
  viewW: number
  pictureH: number
  topChrome: number
  bottomChrome: number
  /** The bands under the picture, in order. */
  bands: string[]
  /** The band directly under the picture. */
  firstBand: string | null
  widest: number
  /** The authoring console the gallery must not carry. */
  furniturePicker: number
  addFurniture: number
}

async function measure(page: Page): Promise<Gallery> {
  return page.evaluate(() => {
    const round = (n: number) => Math.round(n * 100) / 100
    const viewH = window.innerHeight
    const viewW = window.innerWidth
    const model = document.querySelector('.render-stage .spatial-model')!
    const modelBox = model.getBoundingClientRect()
    const gallery = document.querySelector('.render-gallery')!

    // The bands under the picture, in the order they are drawn.
    const bands = Array.from(gallery.children)
      .filter(el => el !== document.querySelector('.render-stage') && el.getBoundingClientRect().height > 0)
      .map(el => el.className?.toString().split(' ')[0] ?? el.tagName.toLowerCase())

    let widest = 0
    for (const el of Array.from(gallery.querySelectorAll('*'))) {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0) widest = Math.max(widest, rect.width)
    }

    return {
      viewH,
      viewW,
      pictureH: round(modelBox.height),
      topChrome: round(modelBox.top),
      bottomChrome: round(viewH - modelBox.bottom),
      bands,
      firstBand: bands[0] ?? null,
      widest: round(widest),
      furniturePicker: document.querySelectorAll('.render-gallery .spatial-furniture-tools').length,
      addFurniture: Array.from(document.querySelectorAll('.render-gallery .spatial-tb-btn'))
        .filter(el => (el.textContent ?? '').trim() === 'Add furniture').length,
    }
  })
}

test.describe('the chrome of the gallery', () => {
  test.use({ actionTimeout: 30_000 })
  // The gallery opens a 3D scene, and a software-rendered 3D scene can take a
  // minute to mount on a loaded machine. The budget is the scene's, not the
  // test's.
  test.describe.configure({ timeout: 180_000 })

  test('the picture outweighs the chrome below it', async ({ page }, testInfo) => {
    for (const [width, height] of [[1440, 900], [1024, 900], [1024, 800], [1280, 720], [390, 844]] as const) {
      await page.setViewportSize({ width, height })
      await openStudio(page)
      await openGallery(page)
      const gallery = await measure(page)
      await page.screenshot({ path: testInfo.outputPath(`gallery-${width}x${height}.png`) })
      await testInfo.attach(`geometry-${width}x${height}`, { body: JSON.stringify(gallery), contentType: 'application/json' })
      // The picture is the work, and the work outweighs the chrome under it —
      // the rule the Plan view has been held to since 2026-10-27. Before the
      // pass the gallery's picture was 295px against 549px of chrome on a
      // phone: the chrome outweighed the work by nearly two to one.
      expect(gallery.pictureH, `the picture must outweigh the chrome below it at ${width}px`).toBeGreaterThan(gallery.bottomChrome)
      expect(gallery.bottomChrome / gallery.viewH, `the chrome below the picture stays under a third at ${width}px`).toBeLessThan(0.35)
      // And the picture keeps at least two fifths of the screen.
      expect(gallery.pictureH / gallery.viewH, `the picture keeps two fifths of the screen at ${width}px`).toBeGreaterThan(0.4)
    }
  })

  test('the picture’s index sits directly under the picture', async ({ page }) => {
    await openStudio(page)
    await openGallery(page)
    const gallery = await measure(page)
    // The reader's first question in a gallery is "which picture is this, and
    // what else is there". The index answers it, so it is the first band under
    // the picture and not two bands away under the figures.
    expect(gallery.firstBand, 'the index is the first band under the picture').toBe('render-navigation')
  })

  test('the gallery carries no editing console', async ({ page }) => {
    await openStudio(page)
    await openGallery(page)
    const gallery = await measure(page)
    // The gallery shows pictures. Placing furniture in a picture gallery is
    // the Spatial view's job, so the furniture picker and the button that
    // opens it do not belong here.
    expect(gallery.furniturePicker, 'the gallery has no furniture picker').toBe(0)
    expect(gallery.addFurniture, 'the gallery has no Add furniture button').toBe(0)
  })

  test('the gallery keeps the hour the picture was taken at', async ({ page }) => {
    await openStudio(page)
    await openGallery(page)
    // The picture is a study scene, not a still: the sun moves and the picture
    // moves with it. The hour is the picture's own control, so it stays.
    await expect(page.locator('.render-local-controls .sun-scrubber')).toBeVisible()
    await expect(page.getByLabel('Sun time of day', { exact: true })).toBeVisible()
  })

  test('the picture says what it is', async ({ page }) => {
    await openStudio(page)
    await openGallery(page)
    // The honesty the disclaimer used to carry in its own band now sits with
    // the picture it describes.
    await expect(page.locator('.spatial-picture-note')).toContainText('your drawing')
  })

  test('nothing in the gallery is wider than the window', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openStudio(page)
    await openGallery(page)
    const gallery = await measure(page)
    expect(gallery.widest, 'no element may be wider than the window it is drawn in').toBeLessThanOrEqual(gallery.viewW + 1)
    for (const size of await page.locator('.render-navigation .render-thumbs strong, .render-navigation .render-thumbs small').evaluateAll(els => els.map(el => parseFloat(getComputedStyle(el).fontSize)))) {
      expect(size, 'view choices keep the readable 12px note role').toBeGreaterThanOrEqual(12)
    }
  })
})


test('gallery viewing keys preserve the plan selection without editing it', async ({ page }) => {
  await openStudio(page)
  const room = page.locator('.room').first()
  const box = (await room.boundingBox())!
  await room.click({ position: { x: box.width - 6, y: box.height - 6 } })
  await expect(page.locator('.room.is-selected')).toHaveCount(1)
  const geometry = () => page.locator('.room').evaluateAll(els => els.map(el => {
    const { left, top, width, height } = (el as HTMLElement).style
    return { left, top, width, height }
  }))
  const before = await geometry()
  await openGallery(page)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Delete')
  await page.keyboard.press('Backspace')
  await page.getByRole('button', { name: 'Plan', exact: true }).click()
  await expect(page.locator('.room')).toHaveCount(chinaApartmentPlan.rooms.length)
  await expect(page.locator('.room.is-selected')).toHaveCount(1)
  expect(await geometry()).toEqual(before)
})
