import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
const HASH = (await readFile('docs/evidence/sample-hash.txt', 'utf8')).trim()
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader'] })
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } })
  const page = await ctx.newPage()
  await page.addInitScript(() => window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
  await page.goto(`http://[::1]:4186/#plan=${HASH}`)
  await page.locator('.plan-canvas').waitFor({ timeout: 30000 })
  await page.waitForTimeout(1200)
  // Zoom out to the whole sheet.
  const label = page.locator('.zoom-label')
  const zoomOut = page.getByRole('button', { name: 'Zoom out' })
  for (let i = 0; i < 14; i += 1) {
    if (await zoomOut.isDisabled()) break
    await zoomOut.click()
    await page.waitForTimeout(260)
  }
  await page.waitForTimeout(400)
  const out = await page.evaluate(() => {
    const round = (n) => Math.round(n * 100) / 100
    const v = document.querySelector('.plan-viewport').getBoundingClientRect()
    const c = document.querySelector('.plan-canvas').getBoundingClientRect()
    const d = document.querySelector('.dimension-x').getBoundingClientRect()
    const dy = document.querySelector('.dimension-y').getBoundingClientRect()
    const numX = document.querySelector('.dimension-x span')?.getBoundingClientRect()
    const numY = document.querySelector('.dimension-y span')?.getBoundingClientRect()
    const inside = (r) => r.left >= v.left - 0.5 && r.right <= v.right + 0.5 && r.top >= v.top - 0.5 && r.bottom <= v.bottom + 0.5
    return {
      zoom: document.querySelector('.zoom-label').textContent,
      view: { l: round(v.left), r: round(v.right), t: round(v.top), b: round(v.bottom) },
      sheet: { l: round(c.left), r: round(c.right), t: round(c.top), b: round(c.bottom) },
      dimXStripInside: inside(d), dimYStripInside: inside(dy),
      numX: numX ? { text: document.querySelector('.dimension-x span').textContent, l: round(numX.left), r: round(numX.right), t: round(numX.top), b: round(numX.bottom), inside: inside(numX) } : null,
      numY: numY ? { text: document.querySelector('.dimension-y span').textContent, l: round(numY.left), r: round(numY.right), t: round(numY.top), b: round(numY.bottom), inside: inside(numY) } : null,
    }
  })
  console.log(`\n=== ${w}x${h} at ${out.zoom} ===`)
  console.log(`  viewport ${out.view.l}→${out.view.r}, ${out.view.t}→${out.view.b}`)
  console.log(`  sheet     ${out.sheet.l}→${out.sheet.r}, ${out.sheet.t}→${out.sheet.b}`)
  console.log(`  dimension-x number "${out.numX?.text}" inside: ${out.numX?.inside ? 'yes' : 'NO'}  (${out.numX?.l}→${out.numX?.r}, ${out.numX?.t}→${out.numX?.b})`)
  console.log(`  dimension-y number "${out.numY?.text}" inside: ${out.numY?.inside ? 'yes' : 'NO'}  (${out.numY?.l}→${out.numY?.r}, ${out.numY?.t}→${out.numY?.b})`)
  await page.screenshot({ path: `/tmp/zoom-${w}.png` })
  await ctx.close()
}
await b.close()
