/**
 * The released site, walked through the journey.
 *
 * Presence is not capability. This drives the public site the way a reader
 * would: draw a room over an existing one, take the warning the studio
 * gives, and use the tool it offers; then erase something and undo it.
 *
 *   node scripts/verify-live-journey.mjs [url]
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
await page.locator('.room').first().waitFor({ timeout: 30_000 })

const stamp = await page.evaluate(() => document.querySelector('meta[name="designon-build"]')?.getAttribute('content') ?? 'none')
console.log(`serving commit: ${stamp}`)

const rooms = () => page.locator('.room').count()

// --- The eraser ------------------------------------------------------------
const before = await rooms()
await page.getByRole('button', { name: 'Erase', exact: true }).click()
const room = page.locator('.room').first()
const box = await room.boundingBox()
await page.mouse.click(box.x + 8, box.y + box.height - 8)
await page.waitForTimeout(900)
const afterErase = await rooms()
console.log(`erase: ${before} rooms → ${afterErase}`)
if (afterErase >= before) console.log('  FAILED: the eraser did not remove the room')
await page.getByRole('button', { name: 'Undo', exact: true }).click()
await page.waitForTimeout(900)
console.log(`undo: ${await rooms()} rooms`)

// --- The trim, from the warning -------------------------------------------
await page.getByRole('button', { name: 'Pencil', exact: true }).click()
const stage = await page.locator('.plan-canvas').boundingBox()
const room2 = await page.locator('.room').first().boundingBox()
// A box drawn over the first room's corner, so the two cross.
await page.mouse.move(room2.x + 20, room2.y + 20)
await page.mouse.down()
await page.mouse.move(room2.x + 120, room2.y + 120, { steps: 10 })
await page.mouse.up()
await page.waitForTimeout(1200)

const warning = page.locator('.overlap-warning')
const warned = await warning.count()
console.log(`overlap warning: ${warned > 0 ? 'shown' : 'not shown'}`)
if (warned > 0) {
  console.log(`  text: ${(await warning.innerText()).replace(/\s+/g, ' ').trim()}`)
  const trimButton = page.getByRole('button', { name: 'Trim the overlap' })
  console.log(`  "Trim the overlap": ${await trimButton.count() > 0 ? 'offered' : 'MISSING'}`)
  if (await trimButton.count() > 0) {
    await trimButton.click()
    await page.waitForTimeout(1200)
    console.log(`  after the trim, the warning is ${await page.locator('.overlap-warning').count() > 0 ? 'still there' : 'gone'}`)
  }
}
void stage

await browser.close()
