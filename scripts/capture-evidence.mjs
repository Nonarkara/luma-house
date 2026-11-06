/**
 * The rendered evidence, refreshed from the current build.
 *
 * A gate that reads the DOM proves the numbers; a screenshot proves the
 * screen. Both are kept, at the three widths the law names.
 *
 *   node scripts/capture-evidence.mjs [baseUrl]
 */
import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const base = process.argv[2] ?? 'http://localhost:4186'
const out = 'docs/evidence/measure'
const HASH = (await readFile(process.env.SAMPLE_HASH_FILE ?? 'docs/evidence/sample-hash.txt', 'utf8')).trim()

await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader'],
})

for (const [width, height] of [[1440, 900], [1024, 800], [390, 844]]) {
  for (const view of ['Plan', 'Spatial', 'Renders']) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    await page.addInitScript(() => window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
    await page.goto(`${base}/#plan=${HASH}`)
    await page.locator('.app-shell').waitFor({ timeout: 60_000 })
    if (view !== 'Plan') {
      await page.getByRole('button', { name: view, exact: true }).click({ noWaitAfter: true })
      await page.locator('.spatial3d-shell').waitFor({ timeout: 90_000 })
      await page.waitForTimeout(3000)
    } else {
      await page.waitForTimeout(1200)
    }
    await page.evaluate(() => document.fonts.ready)
    const key = `${view.toLowerCase()}-${width}x${height}`
    await page.screenshot({ path: `${out}/${key}.png` })
    const measure = await page.evaluate(() => {
      const round = (n) => Math.round(n * 100) / 100
      const work = document.querySelector('.plan-viewport, .spatial-model')
      const box = work ? work.getBoundingClientRect() : null
      return {
        viewH: window.innerHeight,
        work: box ? round(box.height) : null,
        topChrome: box ? round(box.top) : null,
        bottomChrome: box ? round(window.innerHeight - box.bottom) : null,
        tools: Array.from(document.querySelectorAll('.floating-island-toolbar .toolbar-pill-btn'))
          .map(el => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim()),
      }
    })
    await writeFile(`${out}/${key}.json`, JSON.stringify(measure, null, 2))
    console.log(`${key}: work ${measure.work}px, chrome ${measure.topChrome}↑ ${measure.bottomChrome}↓`)
    await context.close()
  }
}

await browser.close()
