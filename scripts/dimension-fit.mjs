/**
 * §10.1, measured: do the field-dimension annotations hang outside the
 * drawing?
 *
 * The finding was that `.dimension-x` (24px below the sheet) and
 * `.dimension-y` (24px to its right) were drawn outside `.plan-canvas` and
 * clipped by the viewport's edge. The repair was in the canvas fit, not the
 * CSS: the sheet is fitted with a gutter wide enough to hold them.
 *
 *   node scripts/dimension-fit.mjs [baseUrl]
 */
import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const base = process.argv[2] ?? 'http://localhost:4186'
const HASH = (await readFile(process.env.SAMPLE_HASH_FILE ?? 'docs/evidence/sample-hash.txt', 'utf8')).trim()

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader'],
})

for (const [width, height] of [[1440, 900], [1024, 800], [390, 844]]) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  await page.addInitScript(() => window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
  await page.goto(`${base}/#plan=${HASH}`)
  await page.locator('.app-shell').waitFor({ timeout: 60_000 })
  await page.locator('.plan-canvas').waitFor({ timeout: 30_000 })
  await page.waitForTimeout(1200)

  const out = await page.evaluate(() => {
    const round = (n) => Math.round(n * 100) / 100
    const viewport = document.querySelector('.plan-viewport').getBoundingClientRect()
    const canvas = document.querySelector('.plan-canvas').getBoundingClientRect()
    const read = (selector) => {
      const el = document.querySelector(selector)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        left: round(r.left), right: round(r.right), top: round(r.top), bottom: round(r.bottom),
        w: round(r.width), h: round(r.height),
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
      }
    }
    const inside = (box, frame) => !!box && box.left >= frame.left - 0.5 && box.right <= frame.right + 0.5 && box.top >= frame.top - 0.5 && box.bottom <= frame.bottom + 0.5
    const dimX = read('.dimension-x')
    const dimY = read('.dimension-y')
    const chip = read('.scale-chip')
    return {
      viewport: { w: round(viewport.width), h: round(viewport.height), left: round(viewport.left), top: round(viewport.top), right: round(viewport.right), bottom: round(viewport.bottom) },
      canvas: { w: round(canvas.width), h: round(canvas.height), left: round(canvas.left), top: round(canvas.top), right: round(canvas.right), bottom: round(canvas.bottom) },
      dimX, dimY,
      dimXInside: inside(dimX, viewport),
      dimYInside: inside(dimY, viewport),
      canvasInside: inside(canvas, viewport),
      chipText: chip?.text ?? null,
      scaleLabel: document.querySelectorAll('.scale-label').length,
    }
  })

  console.log(`\n=== ${width}x${height} ===`)
  console.log(`  viewport ${out.viewport.w}×${out.viewport.h}   sheet ${out.canvas.w}×${out.canvas.h}`)
  console.log(`  dimension-x "${out.dimX?.text}"  inside the viewport: ${out.dimXInside ? 'yes' : 'NO'}`)
  console.log(`  dimension-y "${out.dimY?.text}"  inside the viewport: ${out.dimYInside ? 'yes' : 'NO'}`)
  console.log(`  the sheet itself inside the viewport: ${out.canvasInside ? 'yes' : 'NO'}`)
  console.log(`  the scale chip says: ${out.chipText}`)
  console.log(`  leftover .scale-label elements: ${out.scaleLabel}`)
  await context.close()
}

await browser.close()
