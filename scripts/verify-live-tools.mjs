/**
 * The released site, exercised for real.
 *
 * The local suite proves the code; this proves the *deployment*: the tools
 * the journey needs are on the public site, they work there, and the page
 * says which commit it is.
 *
 *   node scripts/verify-live-tools.mjs [url]
 */
import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const url = process.argv[2] ?? 'https://designon.nonarkara.org/'
const HASH = (await readFile(process.env.SAMPLE_HASH_FILE ?? 'docs/evidence/sample-hash.txt', 'utf8')).trim()

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader'],
})
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
await page.addInitScript(() => window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
await page.goto(`${url}#plan=${HASH}`)
await page.locator('.app-shell').waitFor({ timeout: 60_000 })

const stamp = await page.evaluate(() => document.querySelector('meta[name="designon-build"]')?.getAttribute('content') ?? 'none')
console.log(`serving commit: ${stamp}`)

const tools = await page.evaluate(() => Array.from(document.querySelectorAll('.floating-island-toolbar .toolbar-pill-btn'))
  .map(el => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim()))
console.log(`plan tools: ${tools.join(', ')}`)

for (const name of ['Erase', 'Trim']) {
  const present = await page.getByRole('button', { name, exact: true }).count()
  console.log(`  ${name}: ${present > 0 ? 'present' : 'MISSING'}`)
}

// The split: the 3D beside the plan.
const split = await page.getByRole('button', { name: 'Plan + 3D' }).count()
console.log(`  Plan + 3D: ${split > 0 ? 'present' : 'MISSING'}`)

// The gallery: its index directly under the picture, and no furniture picker.
await page.getByRole('button', { name: 'Renders', exact: true }).click({ noWaitAfter: true })
await page.locator('.render-gallery').waitFor({ timeout: 90_000 })
await page.locator('.spatial-model').waitFor({ timeout: 90_000 })
await page.waitForTimeout(2000)
const gallery = await page.evaluate(() => {
  const round = (n) => Math.round(n * 100) / 100
  const galleryEl = document.querySelector('.render-gallery')
  const model = document.querySelector('.render-stage .spatial-model')
  const modelBox = model.getBoundingClientRect()
  const bands = Array.from(galleryEl.children)
    .filter(el => el !== document.querySelector('.render-stage') && el.getBoundingClientRect().height > 0)
    .map(el => ({ name: el.className?.toString().split(' ')[0], top: el.getBoundingClientRect().top }))
    .sort((a, b) => a.top - b.top)
    .map(b => b.name)
  return {
    pictureH: round(modelBox.height),
    bottomChrome: round(window.innerHeight - modelBox.bottom),
    firstBand: bands[0] ?? null,
    furniturePicker: document.querySelectorAll('.render-gallery .spatial-furniture-tools').length,
    hour: document.querySelectorAll('.render-local-controls .sun-scrubber').length,
  }
})
console.log(`gallery: picture ${gallery.pictureH}px, chrome below ${gallery.bottomChrome}px, first band "${gallery.firstBand}", furniture picker ${gallery.furniturePicker}, hour control ${gallery.hour}`)

await browser.close()
