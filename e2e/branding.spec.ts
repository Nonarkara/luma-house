import { test, expect } from '@playwright/test'
import { themes } from '../src/design/themes'

for (const theme of themes) for (const width of [375, 1280]) {
  test(`${theme.name}: transparent branding and web-app guide at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.addInitScript(id => localStorage.setItem('designon:appearance', id), theme.id)
    await page.goto('/')
    const welcome = page.locator('.welcome-card')
    await expect(welcome.locator('.welcome-brand img')).toHaveCount(2)
    await expect(welcome.getByRole('heading', { name: /Draw a wall/ })).toBeVisible()
    await welcome.locator('.web-app-access summary').click()
    await expect(welcome.getByText('iPhone', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    await welcome.getByRole('button', { name: 'Explore the 50 m² sample' }).click()
    const images = page.locator('.brand img, .app-platforms img')
    await expect(images).toHaveCount(3)
    const assetChecks = await images.evaluateAll(async imgs => Promise.all(imgs.map(async node => {
      const img = node as HTMLImageElement
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let clear = 0, paintedWhite = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) clear++
        if (data[i + 3] > 240 && data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) paintedWhite++
      }
      const box = img.getBoundingClientRect(), css = getComputedStyle(img)
      return { clear: clear / (data.length / 4), paintedWhite, width: box.width, height: box.height, filter: css.filter, background: css.backgroundColor }
    })))
    for (const asset of assetChecks) {
      expect(asset.clear).toBeGreaterThan(.15)
      expect(asset.paintedWhite).toBe(0)
      expect(asset.width).toBeGreaterThan(20)
      expect(asset.height).toBeGreaterThan(20)
      expect(asset.filter).toBe('none')
      expect(asset.background).toBe('rgba(0, 0, 0, 0)')
    }
    const footer = page.locator('.app-platforms')
    if (width === 1280) {
      const summaryBox = await footer.locator('summary').boundingBox()
      expect(summaryBox!.y + summaryBox!.height).toBeLessThanOrEqual(844)
    }
    await footer.locator('summary').click()
    await page.mouse.wheel(0, 1000)
    await expect.poll(() => footer.locator('.web-app-note').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(844)
    await expect(footer.getByText('Android', { exact: true })).toBeVisible()
    await expect(footer.getByText('iPhone', { exact: true })).toBeVisible()
    await expect(footer.getByText(/An internet connection is needed/)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    expect(await page.locator('.canvas-frame').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(300)
  })
}

test('web-app manifest resolves icons and stays inside the deployment path', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBe('./manifest.webmanifest')
  const manifestUrl = new URL(href!, page.url())
  const response = await request.get(manifestUrl.href)
  expect(response.ok()).toBeTruthy()
  const manifest = await response.json()
  expect(manifest.display).toBe('standalone')
  expect(manifest.start_url).toBe('./')
  expect(manifest.scope).toBe('./')
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(['192x192', '512x512'])
  for (const icon of manifest.icons) {
    const iconResponse = await request.get(new URL(icon.src, manifestUrl).href)
    expect(iconResponse.ok()).toBeTruthy()
    const bytes = await iconResponse.body()
    const size = Number(icon.sizes.split('x')[0])
    expect(bytes.readUInt32BE(16)).toBe(size)
    expect(bytes.readUInt32BE(20)).toBe(size)
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('sizes', '180x180')
})
