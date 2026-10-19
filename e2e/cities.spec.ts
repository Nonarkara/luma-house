import { expectSaved } from './workspace'
import { openCity, expectCity, pickSuggestedCity } from './workspace'
import { chinaApartmentPlan, CHINA_PROJECT_KEY } from '../src/mockups/chinaApartment'
import { test, expect } from '@playwright/test'
import { decodePlanFromHash, encodePlanToHash } from '../src/sharePlan'
import { clickAction } from './workspace'
import { initialPlan } from '../src/plan'
import { starterLocations } from '../src/location/locations'

test('an explicitly loaded sample keeps Shanghai and its rooms after reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the 50 m² sample', exact: true }).click()
  await expect(page.locator('button.room')).toHaveCount(chinaApartmentPlan.rooms.length)
  await expectCity(page, 'Shanghai')
  await page.reload()
  await expect(page.locator('button.room')).toHaveCount(chinaApartmentPlan.rooms.length)
  await expectCity(page, 'Shanghai')
})

test('legacy wrapped JSON imports retain the exported city', async ({ page }) => {
  await page.goto('/#plan=' + encodePlanToHash(initialPlan))
  await clickAction(page, 'Workspace settings')
  const { location: ignoredLocation, ...legacy } = initialPlan
  void ignoredLocation
  await page.locator('input[accept="application/json,.json"]').setInputFiles({ name: 'legacy.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ plan: legacy, location: starterLocations[1] })) })
  await expect(page.getByText('Project imported', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').location?.name, CHINA_PROJECT_KEY)).toBe('Bangkok')
  await page.reload()
  await expectCity(page, 'Bangkok')
})

test('fresh browser-zone city is embedded in share links and survives another time zone', async ({ browser }, info) => {
  const source = await browser.newContext({ baseURL: info.project.use.baseURL, timezoneId: 'Asia/Bangkok', permissions: ['clipboard-read', 'clipboard-write'] })
  const recipient = await browser.newContext({ baseURL: info.project.use.baseURL, timezoneId: 'Asia/Shanghai' })
  try {
    const page = await source.newPage()
    await page.goto('/')
    const welcome = page.getByRole('dialog')
    if (await welcome.isVisible()) await welcome.getByRole('button', { name: /Start from a blank page/i }).click()
    await expectCity(page, 'Bangkok')
    await clickAction(page, 'Share')
    const url = await page.evaluate(() => navigator.clipboard.readText())
    expect(decodePlanFromHash(new URL(url).hash)?.location?.timezone).toBe('Asia/Bangkok')
    const other = await recipient.newPage()
    await other.goto(url)
    await expectCity(other, 'Bangkok')
    await other.reload()
    const returningWelcome = other.getByRole('dialog')
    if (await returningWelcome.isVisible()) await returningWelcome.getByRole('button', { name: /Start from a blank page/i }).click()
    await expectCity(other, 'Bangkok')
  } finally { await source.close(); await recipient.close() }
})

test('worldwide city updates its chart and actual shadows, persists through reload and works offline', async ({ page }) => {
  // The sun study opens on today's date; pin "today" to the December solstice so Tromsø is in polar night.
  await page.clock.setFixedTime(new Date('2026-12-21T11:00:00Z'))
  const aiCalls: string[] = []
  await page.route('**/luma-concept-render.drnon.workers.dev/**', r => { aiCalls.push(r.request().url()); return r.abort() })
  await page.route('**/geocoding-api.open-meteo.com/**', r => r.fulfill({ json: { results: [
    { name: 'Cape Town', admin1: 'Western Cape', country: 'South Africa', latitude: -33.9249, longitude: 18.4241, timezone: 'Africa/Johannesburg' },
  ] } }))
  await page.goto('/#plan=' + encodePlanToHash(initialPlan))
  await page.getByRole('button', { name: 'Renders', exact: true }).click()
  const canvas = page.locator('.spatial3d-shell canvas')
  await expect.poll(() => canvas.evaluate(c => (c as HTMLCanvasElement).toDataURL().length), { timeout: 20000 }).toBeGreaterThan(10000)
  await page.waitForTimeout(500)
  const before = await canvas.evaluate(c => (c as HTMLCanvasElement).toDataURL())
  await openCity(page)
  await page.getByLabel('Search any city', { exact: true }).fill('Cape Town')
  await page.getByRole('button', { name: /Cape Town, Western Cape, South Africa/ }).click()
  const chart = page.getByLabel('Sun chart for Cape Town, Western Cape, South Africa', { exact: true })
  await expect(chart).toBeVisible()
  await expect(chart).toContainText('Africa/Johannesburg')
  await expect(chart).toContainText('Sunrise')
  await expect.poll(() => canvas.evaluate(c => (c as HTMLCanvasElement).toDataURL())).not.toBe(before)
  await page.getByRole('button', { name: 'Close city search' }).click()
  // Shared URL must now reflect this city, not replay the original hash after a reload.
  await page.getByRole('button', { name: 'Plan', exact: true }).click()
  await page.reload()
  await expectCity(page, 'Cape Town')
  await openCity(page)
  await page.context().setOffline(true)
  await page.getByText('Use exact coordinates · works offline', { exact: true }).click()
  await page.getByLabel('Site latitude', { exact: true }).fill('69.6492')
  await page.getByLabel('Site longitude', { exact: true }).fill('18.9553')
  await page.getByLabel('Site time zone', { exact: true }).fill('Europe/Oslo')
  await page.getByRole('button', { name: 'Use coordinates', exact: true }).click()
  await expect(page.getByLabel(/Sun chart for Site/)).toContainText('Polar night')
  expect(aiCalls).toEqual([])
})

test('fixed interior images are labeled references and never the default render', async ({ page }) => {
  await page.goto('/#plan=' + encodePlanToHash(initialPlan))
  await page.getByRole('button', { name: 'Renders', exact: true }).click()
  await expect(page.getByLabel('Local 3D light study')).toBeVisible()
  await expect(page.locator('.render-stage img')).toHaveCount(0)
  await page.getByText('Concept references · photographs do not represent your drawing', { exact: true }).click()
  await expect(page.getByText('Reference image only.', { exact: true })).toBeVisible()
  await expect(page.locator('.render-references img')).toBeVisible()
})

test('a relocated sample survives reload instead of being discarded as an old demo', async ({ page }) => {
  await page.goto('/#plan=' + encodePlanToHash(chinaApartmentPlan))
  await openCity(page)
  await pickSuggestedCity(page, /Bangkok, Thailand.*Asia\/Bangkok/)
  await page.getByRole('button', { name: 'Close city search' }).click()
  await expectSaved(page)
  await page.reload()
  await expect(page.locator('button.room')).toHaveCount(chinaApartmentPlan.rooms.length)
  await expectCity(page, 'Bangkok')
  await expect(page.getByRole('dialog', { name: /Draw a wall/ })).toHaveCount(0)
})

test('immediate reload keeps a city change before the saved indicator appears', async ({ page }) => {
  await page.goto('/#plan=' + encodePlanToHash(initialPlan))
  await openCity(page)
  await pickSuggestedCity(page, /Bangkok, Thailand.*Asia\/Bangkok/)
  // Do not wait for the debounced "Saved locally" indicator.
  await page.reload()
  await expectCity(page, 'Bangkok')
  await expect(page.locator('button.room')).toHaveCount(initialPlan.rooms.length)
})
