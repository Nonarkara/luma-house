import { expect, test } from '@playwright/test'

const savedPlan = JSON.stringify({
  rooms: [{ id: 'r1', name: 'Saved room', kind: 'studio', x: 10, y: 10, w: 40, h: 40 }],
})

test('a render crash shows the recovery sheet and keeps the drawing downloadable', async ({ page }) => {
  await page.addInitScript(plan => { localStorage.setItem('designon:plan', plan) }, savedPlan)
  await page.goto('/selftest.html')

  const sheet = page.locator('.app-failed-card')
  await expect(sheet.getByText('The drawing desk stopped')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reload the desk' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download a copy' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('designon-plan.json')
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  expect(Buffer.concat(chunks).toString('utf8')).toContain('Saved room')
})

test('the recovery sheet does not offer a copy when nothing was saved', async ({ page }) => {
  await page.goto('/selftest.html')
  await expect(page.locator('.app-failed-card').getByText('The drawing desk stopped')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download a copy' })).toHaveCount(0)
  await expect(page.getByText('No saved drawing was found')).toBeVisible()
})

test('the desk itself still boots with the boundary in place', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(String(error)))
  await page.goto('/?studio=1')
  await expect(page.locator('.topbar')).toBeVisible()
  await expect(page.locator('.app-failed')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('hashed assets are cached immutably and brand artwork is revalidated', async ({ page }) => {
  await page.goto('/')
  const asset = await page.evaluate(() => {
    const script = document.querySelector('script[type="module"]') as HTMLScriptElement
    return script.src.split('/').pop()!
  })
  const hashed = await page.request.get(`/assets/${asset}`)
  expect(hashed.headers()['cache-control']).toContain('immutable')
  const brand = await page.request.get('/brand/designon-wordmark.png')
  expect(brand.headers()['cache-control']).toContain('must-revalidate')
})
