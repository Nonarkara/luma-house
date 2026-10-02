import { test, expect, type Page } from '@playwright/test'
import { decodePlanFromHash, encodePlanToHash } from '../src/sharePlan'
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

  test('Share button writes a valid round-trippable URL to the clipboard', async ({ page }) => {
    await dismissWelcome(page)
    // Open a known plan via the share-link path so we have real rooms to
    // share. The default landing page renders a blank napkin (no
    // localStorage = no fallback), which makes the round-trip assertion
    // tautological.
    await page.goto(`/#plan=${SAMPLE_PLAN_HASH}`)
    const share = page.getByRole('button', { name: 'Share' })
    await expect(share).toBeVisible()
    await expect(share).toBeEnabled()
    // Real click. Playwright grants clipboard-write via the project
    // permissions, so navigator.clipboard.writeText resolves. The handler
    // also replaceState's the address bar to the same URL.
    await share.click()
    const url = await page.evaluate(() => navigator.clipboard.readText())
    expect(url, 'clipboard contains a share URL').toMatch(/#plan=[A-Za-z0-9+/=_-]+$/)
    // The URL must also reflect in the address bar (replaceState on share).
    expect(page.url(), 'address bar mirrors the share URL').toContain('#plan=')
    // Round-trip: the encoded payload must decode back to the same plan
    // we shipped. This catches a regression where sharePlan() encodes a
    // different payload than the one read back by decodePlanFromHash().
    const hash = new URL(url).hash
    const decoded = decodePlanFromHash(hash)
    expect(decoded, 'shared payload decodes back to a plan').toBeTruthy()
    expect(decoded!.rooms.length, 'decoded plan has the same rooms').toBe(initialPlan.rooms.length)
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

  test('mobile viewport does not horizontally overflow (16 px tolerance)', async ({ page }) => {
    await dismissWelcome(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    // 16 px tolerance covers:
    // - the .top-actions button row which sits ~5 px past the viewport by
    //   design (Export + Share + New + Catalog + Help + Settings + Panel
    //   toggle) — reachable via page-scroll, confirmed by the audit.
    // - the journey rail, intentionally scrollable past the viewport with
    //   snap points and a thin scrollbar.
    // - sub-pixel rounding from CSS calc() under modern DPR.
    // The guard trips if a real layout regression adds meaningful scroll
    // (>16 px), which is the actual shipability signal.
    expect(overflow.scrollWidth, 'no horizontal scroll at 390px').toBeLessThanOrEqual(overflow.clientWidth + 16)
  })
})

// The studio must reserve the drawing surface for geometry, and controls must
// still perform real edits after the duplicate toolbars are consolidated.
test.describe('drawing studio', () => {
  for (const width of [375, 768, 1280]) {
    test(`tools stay outside the plan and edits undo at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(`/#plan=${SAMPLE_PLAN_HASH}`)
      await expect(page).toHaveTitle(/designon/)
      const canvas = page.locator('.canvas-frame')
      const toolbar = page.getByRole('toolbar', { name: 'Plan tools' })
      await expect(toolbar).toHaveCount(1)
      const canvasRect = await canvas.boundingBox()
      const toolbarRect = await toolbar.boundingBox()
      expect(toolbarRect!.y + toolbarRect!.height).toBeLessThanOrEqual(canvasRect!.y)
      expect(canvasRect!.height).toBeGreaterThanOrEqual(300)
      await page.getByRole('button', { name: 'Add room', exact: true }).click()
      expect(await readRoomCount(page)).toBe(initialPlan.rooms.length + 1)
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      expect(await readRoomCount(page)).toBe(initialPlan.rooms.length)
      for (const name of ['Tape Measure', 'Layout presets']) {
        await page.getByRole('button', { name, exact: true }).click({ trial: true })
      }
      await page.getByRole('button', { name: 'Calibrate', exact: true }).click({ trial: true })
      await page.getByRole('button', { name: 'Tape Measure', exact: true }).click()
      await page.getByRole('button', { name: 'Pencil', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Tape Measure', exact: true })).toHaveAttribute('aria-pressed', 'false')
      const hint = await page.locator('.draw-hint').boundingBox()
      const zoom = await page.locator('.zoom-control').boundingBox()
      const intersects = hint!.x < zoom!.x + zoom!.width && hint!.x + hint!.width > zoom!.x && hint!.y < zoom!.y + zoom!.height && hint!.y + hint!.height > zoom!.y
      expect(intersects, 'zoom controls must not cover the drawing grammar').toBe(false)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(1)
    })
  }
  test('paper, ink, action and index text have readable contrast', async ({ page }) => {
    await page.goto(`/#plan=${SAMPLE_PLAN_HASH}`)
    const contrast = await page.evaluate(() => {
      const luminance = (color: string) => {
        const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => {
          const n = v / 255
          return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4
        })
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
      }
      return ['.stage-head h1', '.button.primary', '.journey-headline'].map(selector => {
        const el = document.querySelector(selector)!
        const fg = luminance(getComputedStyle(el).color)
        let bgEl: Element | null = el
        while (bgEl && getComputedStyle(bgEl).backgroundColor === 'rgba(0, 0, 0, 0)') bgEl = bgEl.parentElement
        const bg = luminance(getComputedStyle(bgEl!).backgroundColor)
        return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05)
      })
    })
    for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
})

/**
 * PWA installability — Codex's a7b02f6 added the manifest, icons and the
 * WebAppAccess component with Android / iPhone install guidance. Physical
 * phone install is hard to test in headless Chromium, but every digital
 * prerequisite (manifest schema, icon HTTP, install hints, theme color) is
 * checkable here. A regression that breaks the install path on a real
 * device will also break one of these.
 */
test.describe('PWA installability', () => {
  test('manifest.webmanifest is reachable and exposes install-required fields', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest')
    expect(res.status(), 'manifest status').toBe(200)
    const manifest = await res.json()
    // PWA install requires these. Chromium's installability check looks
    // at them all — drop one and the install prompt never fires.
    for (const field of ['name', 'short_name', 'start_url', 'scope', 'display']) {
      expect(manifest[field], `manifest.${field}`).toBeTruthy()
    }
    expect(manifest.display, 'manifest.display=standalone so the app launches full-screen').toBe('standalone')
    expect(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'manifest declares 192 + 512 icons').toBe(true)
    for (const size of ['192x192', '512x512']) {
      expect(
        manifest.icons.some((icon: { sizes: string }) => icon.sizes === size),
        `manifest declares a ${size} icon`,
      ).toBe(true)
    }
  })

  test('every manifest icon URL returns 200 with the declared content type', async ({ request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json()
    for (const icon of manifest.icons as Array<{ src: string; type: string }>) {
      const res = await request.get(icon.src)
      expect(res.status(), `${icon.src} status`).toBe(200)
      const ct = res.headers()['content-type'] ?? ''
      expect(ct.startsWith(icon.type), `${icon.src} content-type starts with ${icon.type}, got ${ct}`).toBe(true)
    }
  })

  test('index.html carries the iOS + theme-color meta a home-screen launch needs', async ({ page }) => {
    await page.goto('/')
    const meta = await page.evaluate(() => {
      const byName = (n: string) => document.querySelector(`meta[name="${n}"]`)?.getAttribute('content') ?? null
      const appleTouch = document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ?? null
      const manifestLink = document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? null
      return {
        appleCapable: byName('apple-mobile-web-app-capable'),
        appleTitle: byName('apple-mobile-web-app-title'),
        themeColor: byName('theme-color'),
        appleTouch,
        manifestLink,
      }
    })
    expect(meta.appleCapable, 'apple-mobile-web-app-capable=yes').toBe('yes')
    expect(meta.appleTitle, 'apple-mobile-web-app-title is set').toBeTruthy()
    expect(meta.themeColor, 'theme-color is set (Android address bar tint)').toBeTruthy()
    expect(meta.appleTouch, 'apple-touch-icon link is present').toBeTruthy()
    expect(meta.manifestLink, 'manifest link is present').toBeTruthy()
  })

  test('WebAppAccess install guidance is reachable in the DOM', async ({ page }) => {
    await dismissWelcome(page)
    await page.goto('/')
    const section = page.locator('.web-app-access')
    await expect(section, 'install guidance is rendered').toHaveCount(1)
    // Both platform strings must be present — the audit agent flagged that
    // the guidance must explicitly cover Android and iPhone, not just one.
    const text = (await section.innerText()).toLowerCase()
    expect(text, 'mentions Android').toContain('android')
    expect(text, 'mentions iPhone').toContain('iphone')
    expect(text, 'mentions Add to Home Screen').toContain('home screen')
  })
})
