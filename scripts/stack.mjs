/**
 * The vertical stack of the studio, band by band, with the space between.
 *
 * A gap is space that belongs to nothing. This prints the bands of the
 * workspace column with their heights, so the gaps can be named and removed
 * rather than guessed at.
 *
 *   node scripts/stack.mjs [baseUrl] [view] [width] [height]
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'

const base = process.argv[2] ?? 'http://localhost:4186'
const view = process.argv[3] ?? 'Renders'
const width = Number(process.argv[4] ?? 390)
const height = Number(process.argv[5] ?? 844)
const HASH = (await readFile(process.env.SAMPLE_HASH_FILE ?? '/tmp/sample-hash.txt', 'utf8')).trim()

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader'],
})
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
const page = await context.newPage()
await page.addInitScript(() => window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
await page.goto(`${base}/#plan=${HASH}`)
await page.locator('.app-shell').waitFor({ timeout: 30_000 })
if (view !== 'Plan') {
  await page.getByRole('button', { name: view, exact: true }).click({ noWaitAfter: true })
  await page.locator('.spatial3d-shell').waitFor({ timeout: 60_000 })
  await page.waitForTimeout(2500)
}

const out = await page.evaluate(() => {
  const round = (n) => Math.round(n * 100) / 100
  const rows = []
  const walk = (el, depth) => {
    if (depth > 6) return
    for (const child of Array.from(el.children)) {
      const style = getComputedStyle(child)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const rect = child.getBoundingClientRect()
      if (rect.height < 1) continue
      const text = (child.innerText ?? '').replace(/\s+/g, ' ').trim()
      rows.push({
        depth,
        h: round(rect.height),
        w: round(rect.width),
        top: round(rect.top),
        cls: (child.className?.toString() ?? child.tagName.toLowerCase()).slice(0, 46),
        text: text.length > 48 ? `${text.slice(0, 48)}…` : text,
        absolute: style.position === 'absolute' || style.position === 'fixed',
      })
      walk(child, depth + 1)
    }
  }
  walk(document.querySelector('.app-shell'), 0)
  return { rows, viewH: window.innerHeight }
})

console.log(`\n=== ${view} ${width}x${height} — viewport ${out.viewH}px ===`)
for (const row of out.rows) {
  console.log(`${'  '.repeat(row.depth)}${String(row.h).padStart(7)}px  ${row.cls.padEnd(48)}${row.absolute ? '(floats) ' : ''}${row.text}`)
}

await browser.close()
