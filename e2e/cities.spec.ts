import { chinaApartmentPlan } from '../src/mockups/chinaApartment'
import { test, expect } from '@playwright/test'
import { encodePlanToHash } from '../src/sharePlan'
import { initialPlan } from '../src/plan'

test('worldwide city updates its chart and actual shadows, persists through reload and works offline', async ({ page }) => {
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
  await page.getByRole('button', { name: /Change city/ }).click()
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
  await expect(page.getByRole('button', { name: /Cape Town.*Change city/ })).toBeVisible()
  await page.getByRole('button', { name: /Change city/ }).click()
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
  await page.getByRole('button', { name: /Change city/ }).click()
  await page.getByRole('button', { name: /Bangkok, Thailand.*Asia\/Bangkok/ }).click()
  await page.getByRole('button', { name: 'Close city search' }).click()
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('button.room')).toHaveCount(chinaApartmentPlan.rooms.length)
  await expect(page.getByRole('button', { name: /Bangkok, Thailand.*Change city/ })).toBeVisible()
  await expect(page.getByRole('dialog', { name: /Draw a wall/ })).toHaveCount(0)
})
