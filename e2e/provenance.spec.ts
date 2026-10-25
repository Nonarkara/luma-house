import { expect, test } from '@playwright/test'
import { chinaApartmentPlan } from '../src/mockups/chinaApartment'
import { encodePlanToHash } from '../src/sharePlan'
import type { PlanState } from '../src/types'

const capeTown = {
  name: 'Cape Town',
  label: 'Cape Town, South Africa',
  latitude: -33.9249,
  longitude: 18.4241,
  timezone: 'Africa/Johannesburg',
}

const userDrawing: PlanState = {
  rooms: [{ id: 'user-living', name: 'Living', kind: 'living', x: 20, y: 20, w: 40, h: 40 }],
  openings: [{ id: 'user-window', type: 'window', x: 40, y: 20, rotation: 0 }],
  furniture: [],
  systems: { solar: false, insulation: false, climate: false, lighting: false },
  site: { w: 14, h: 10, unit: 1 },
  location: capeTown,
}

async function openStage(page: import('@playwright/test').Page, label: string) {
  await page.getByRole('listitem', { name: new RegExp(label) }).click()
  await expect(page.getByRole('button', { name: 'Collapse inspector', exact: true })).toBeVisible()
}

test.describe('authored evidence provenance', () => {
  test('a user drawing never inherits the Shanghai sample claims', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'desktop audit covers the full inspector sequence')
    await page.goto(`/#plan=${encodePlanToHash(userDrawing)}`)

    await openStage(page, 'Living')
    await expect(page.getByRole('heading', { name: 'Living brief inputs' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /1 room.*1 opening/ })).toBeVisible()
    await expect(page.getByText('South-facing, calm and legible', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Balanced ERV with ePM1 filter', { exact: false })).toHaveCount(0)

    await openStage(page, 'Sun')
    await expect(page.getByRole('heading', { name: 'Cape Town sun study' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Lighting circuits not specified' })).toBeVisible()
    await expect(page.getByText('Six lighting channels', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/Solar position uses Cape Town, South Africa/)).toBeVisible()

    await openStage(page, 'Systems')
    await expect(page.getByText('Selected assumptions', { exact: true })).toBeVisible()
    await expect(page.getByText('0 / 4', { exact: true })).toBeVisible()
    await expect(page.getByText('Capacity, usable roof area and approvals not specified', { exact: true })).toBeVisible()
    await expect(page.getByText('2.2 kWp', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Predicted reduction', { exact: true })).toHaveCount(0)
  })

  test('the intact sample keeps its authored schedules', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'desktop audit covers the full inspector sequence')
    await page.goto(`/#plan=${encodePlanToHash(chinaApartmentPlan)}`)

    await openStage(page, 'Living')
    await expect(page.getByText('South-facing, calm and legible', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Custom interior schedule' })).toBeVisible()

    await openStage(page, 'Systems')
    await expect(page.getByRole('heading', { name: 'Installed capacity' })).toBeVisible()
    await expect(page.getByText('2.2 kWp', { exact: true })).toBeVisible()
  })

  test('the evidence panel remains legible at the three audit widths', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'one controlled responsive sweep is sufficient')
    for (const [width, height] of [[1440, 900], [1024, 768], [390, 844]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(`/#plan=${encodePlanToHash(userDrawing)}`)
      await openStage(page, 'Living')
      await expect(page.getByRole('heading', { name: 'Living brief inputs' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(16)
      await page.screenshot({ path: info.outputPath(`living-evidence-${width}.png`), fullPage: true })
    }
  })
})
