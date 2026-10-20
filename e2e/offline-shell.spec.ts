import { expect, test } from '@playwright/test'

/**
 * The offline shell.
 *
 * designon is installed as a web app and every drawing, sun study and cost
 * estimate is computed on the device. This spec proves the claim the app
 * makes to a person standing on a site with no signal: the application
 * opens, and it draws.
 *
 * The application skips worker registration under automation on purpose, so
 * this spec installs the shell itself and then reads what it served.
 */

const guideTitle = 'A home, from the first line.'

async function installShell(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href)
    await navigator.serviceWorker.ready
  })
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true)
}

test('the installed app opens with no network at all', async ({ page, context }) => {
  await installShell(page)

  // Clear the browser's own HTTP cache. Without this the page's assets would
  // be answered by the disk cache — which is a different promise — and the
  // worker would look like it worked when it had done nothing.
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.clearBrowserCache')

  await context.setOffline(true)

  // Prove the network really is gone, from inside the page.
  const probe = await page.evaluate(() =>
    fetch('/__offline_probe__', { cache: 'no-store' }).then(() => 'reached', () => 'unreachable'),
  )
  expect(probe).toBe('unreachable')

  const response = await page.reload()
  // The shell is served by the worker, not by the browser's HTTP cache:
  // only the worker's offline fallback carries this header.
  expect(response?.headers()['x-designon-shell']).toBe('offline')
  await expect(page.getByRole('dialog', { name: guideTitle })).toBeVisible()

  await page.goto('/?studio=1')
  await expect(page.getByTestId('plan-canvas')).toBeVisible()
})

test('the shell does not disturb the application when the network answers', async ({ page }) => {
  await installShell(page)

  const response = await page.reload()
  expect(response?.headers()['x-designon-shell']).toBeUndefined()
  await expect(page.getByRole('dialog', { name: guideTitle })).toBeVisible()

  await page.goto('/?studio=1')
  await expect(page.getByTestId('plan-canvas')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const faces = await page.evaluate(() =>
    Array.from(document.fonts).filter(face => face.status === 'loaded').map(face => face.family),
  )
  expect(faces.length).toBeGreaterThan(0)
})
