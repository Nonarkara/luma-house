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
  await page.waitForTimeout(1500)
  const zoom = await page.evaluate(() => {
    const stage = document.querySelector('.plan-stage')
    const label = document.querySelector('.zoom-label')
    const dim = document.querySelector('.dimension-x')
    const v = document.querySelector('.plan-viewport').getBoundingClientRect()
    const d = dim.getBoundingClientRect()
    return { transform: getComputedStyle(stage).transform, zoom: label?.textContent, dimLeft: Math.round(d.left), dimRight: Math.round(d.right), dimBottom: Math.round(d.bottom), viewLeft: Math.round(v.left), viewRight: Math.round(v.right), viewBottom: Math.round(v.bottom) }
  })
  console.log(`${w}x${h}:`, JSON.stringify(zoom))
  await page.screenshot({ path: `/tmp/plan-${w}.png` })
  await ctx.close()
}
await b.close()
