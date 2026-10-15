import { expect, test, type Page } from '@playwright/test'
import { encodePlanToHash } from '../src/sharePlan'
import { initialPlan } from '../src/plan'
import { openMore } from './workspace'

const hash = encodePlanToHash(initialPlan)

async function placeVelvetSofa(page: Page) {
  await page.addInitScript(() => localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
  await page.goto(`/#plan=${hash}`)
  await openMore(page)
  await page.getByRole('button', { name: 'Furniture Catalog', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Furniture catalog' })).toBeVisible()
  await page.getByRole('button', { name: /Add Velvet sofa/ }).click()
  await expect(page.locator('.furniture-chip')).toContainText('Velvet sofa')
}

test.describe('measured furniture in local 3D', () => {
  test('preserves the selected asset and lazy-loads it only in Solid view', async ({ page }) => {
    await placeVelvetSofa(page)
    await expect.poll(() => page.evaluate(() => {
      const raw = localStorage.getItem('designon:plan:south-light-shanghai-50:v4')
      return raw ? JSON.parse(raw).furniture?.at(-1)?.assetId : null
    })).toBe('glam-velvet-sofa')
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('designon:plan:south-light-shanghai-50:v4')!))
    expect(stored.furniture.at(-1)).toMatchObject({
      kind: 'sofa',
      label: 'Velvet sofa',
      assetId: 'glam-velvet-sofa',
      wM: 2.19,
      dM: 1.02,
    })

    const request = page.waitForResponse(response =>
      response.url().endsWith('/furniture/models/glam-velvet-sofa.glb') && response.status() === 200,
    )
    await page.getByRole('button', { name: 'Spatial', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Solid', exact: true })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Solid', exact: true }).click()
    await request
    await expect(page.locator('.spatial3d-shell canvas')).toBeVisible()
  })

  test('a missing model falls back without taking down the building', async ({ page }) => {
    await page.route('**/furniture/models/glam-velvet-sofa.glb', route => route.abort())
    await placeVelvetSofa(page)
    await page.getByRole('button', { name: 'Spatial', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Solid', exact: true })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Solid', exact: true }).click()
    await expect(page.getByRole('button', { name: '3D Orbit', exact: true })).toBeVisible()
    await expect(page.locator('.spatial3d-shell canvas')).toBeVisible()
  })
})
