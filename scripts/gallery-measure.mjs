/**
 * The gallery measured the way the gate measures it, in the same browser the
 * gate uses. The two answers must be the same number.
 *
 *   node scripts/gallery-measure.mjs [baseUrl] [width] [height]
 */
import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const base = process.argv[2] ?? 'http://localhost:4186'
const width = Number(process.argv[3] ?? 390)
const height = Number(process.argv[4] ?? 844)
const HASH = (await readFile(process.env.SAMPLE_HASH_FILE ?? '/tmp/sample-hash.txt', 'utf8')).trim()

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width, height } })
const page = await context.newPage()
await page.addInitScript(() => window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
await page.goto(`${base}/#plan=${HASH}`)
await page.locator('.app-shell').waitFor({ timeout: 30_000 })
await page.getByRole('button', { name: 'Renders', exact: true }).click({ noWaitAfter: true })
await page.locator('.render-gallery').waitFor({ timeout: 60_000 })
await page.locator('.spatial-model').waitFor({ timeout: 60_000 })
await page.waitForTimeout(2500)

const out = await page.evaluate(() => {
  const round = (n) => Math.round(n * 100) / 100
  const viewH = window.innerHeight
  const model = document.querySelector('.render-stage .spatial-model')
  if (!model) throw new Error('The live gallery model did not mount')
  const box = model.getBoundingClientRect()
  const gallery = document.querySelector('.render-gallery')
  if (!gallery) throw new Error('The gallery did not mount')
  const bands = Array.from(gallery.children).map(el => ({
    cls: el.className?.toString().split(' ')[0] ?? el.tagName.toLowerCase(),
    h: round(el.getBoundingClientRect().height),
  }))
  // Every band in the workspace column, top to bottom.
  const stack = []
  for (const el of Array.from(document.querySelectorAll('.app-shell *'))) {
    const r = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') continue
    if (style.position === 'absolute' || style.position === 'fixed') continue
    if (r.height < 1 || r.width < 200) continue
    const parent = el.parentElement
    if (!parent) continue
    const siblings = Array.from(parent.children).filter(s => getComputedStyle(s).position !== 'absolute' && getComputedStyle(s).position !== 'fixed')
    const index = siblings.indexOf(el)
    if (index !== 0) continue
    stack.push({ cls: el.className?.toString().split(' ')[0] ?? el.tagName.toLowerCase(), h: round(r.height), top: round(r.top) })
  }
  return {
    viewH,
    pictureH: round(box.height),
    pictureTop: round(box.top),
    pictureBottom: round(box.bottom),
    bottomChrome: round(viewH - box.bottom),
    share: round((viewH - box.bottom) / viewH),
    bands,
    stack,
  }
})

console.log(JSON.stringify(out, null, 1))
await browser.close()
