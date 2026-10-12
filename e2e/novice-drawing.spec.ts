import { clickTool, openCity } from './workspace'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
})

test('blank page, room drag, window and door land on the walls', async ({ page }) => {
  const clock: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'warning' && /Clock/.test(message.text())) clock.push(message.text())
  })
  await page.goto('/')
  await page.waitForTimeout(500)
  await expect(page.getByText('Drag a box to make a room. Then click a wall to add a window.')).toBeVisible()
  const size = page.viewportSize()
  if (size && size.width <= 720) {
    const view = await page.locator('.plan-viewport').boundingBox()
    expect(view!.height / size.height).toBeGreaterThanOrEqual(0.55)
    for (const name of ['Draw', 'Window', 'Door', 'Select', 'Undo', 'More tools']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  }

  await clickTool(page, 'Room')
  const sheet = await page.locator('.plan-canvas').boundingBox()
  await page.mouse.click(sheet!.x + sheet!.width / 2, sheet!.y + sheet!.height / 2)
  await expect(page.locator('button.room')).toHaveCount(0)

  await page.mouse.move(sheet!.x + sheet!.width * 0.28, sheet!.y + sheet!.height * 0.22)
  await page.mouse.down()
  await page.mouse.move(sheet!.x + sheet!.width * 0.72, sheet!.y + sheet!.height * 0.72, { steps: 10 })
  await page.mouse.up()
  await expect(page.locator('button.room')).toHaveCount(1)
  const label = (await page.locator('button.room').getAttribute('aria-label')) ?? ''
  const area = Number(label.match(/([\d.]+) square meters/)?.[1] ?? '0')
  expect(area).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Window', exact: true }).click()
  const room = await page.locator('button.room').boundingBox()
  await page.mouse.move(room!.x + room!.width / 2, room!.y + 2)
  await expect(page.locator('.opening.is-ghost')).toBeVisible()
  await page.mouse.click(room!.x + room!.width / 2, room!.y + 2)
  await expect(page.locator('button.opening-window')).toHaveCount(1)
  await expect(page.locator('button.opening-window')).toHaveAttribute('data-rotation', '0')

  await page.mouse.click(room!.x + room!.width - 2, room!.y + room!.height / 2)
  await expect(page.locator('button.opening-window[data-rotation="90"]')).toHaveCount(1)

  await page.locator('.canvas-tools').getByRole('button', { name: 'Door', exact: true }).click()
  await page.mouse.click(room!.x + 2, room!.y + room!.height / 2)
  await expect(page.locator('button.opening-door')).toHaveCount(1)
  await expect(page.locator('button.opening-door')).toHaveAttribute('data-rotation', '90')

  const settled = await page.locator('.plan-canvas').boundingBox()
  await page.mouse.click(settled!.x + 8, settled!.y + 8)
  await expect(page.getByText('Click a wall', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Spatial', exact: true }).click()
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.locator('.spatial3d-shell, canvas').first()).toBeVisible()
  expect(clock).toEqual([])
})

test('four pencil lines close a room with area', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)
  const point = async (x: number, y: number) => {
    const sheet = await page.locator('.plan-canvas').boundingBox()
    return { x: sheet!.x + sheet!.width * x, y: sheet!.y + sheet!.height * y }
  }
  const line = async (ax: number, ay: number, bx: number, by: number) => {
    const a = await point(ax, ay)
    const b = await point(bx, by)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(b.x, b.y, { steps: 6 })
    await page.mouse.up()
  }
  // Ends sit within 0.3 m of the metre grid on the 14 × 10 m site, so the
  // four corners join instead of stopping a cell short of each other.
  await line(0.28, 0.30, 0.72, 0.30)
  await line(0.70, 0.28, 0.70, 0.72)
  await line(0.72, 0.70, 0.28, 0.70)
  await line(0.30, 0.72, 0.30, 0.28)
  await expect(page.locator('button.room')).toHaveCount(1)
  const label = (await page.locator('button.room').getAttribute('aria-label')) ?? ''
  const area = Number(label.match(/([\d.]+) square meters/)?.[1] ?? '0')
  expect(area).toBeGreaterThan(0)
})

test('empty 3D and sun stages offer one way back, and export opens from the plan', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Spatial', exact: true }).click()
  await expect(page.locator('canvas')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Back to plan', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back to plan', exact: true }).click()
  await expect(page.locator('.plan-canvas')).toBeVisible()

  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(page.getByRole('button', { name: 'PNG of the plan', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'PDF study sheet', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'DXF', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'GLB', exact: true })).toBeVisible()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'DXF', exact: true }).click()
  expect((await pending).suggestedFilename()).toMatch(/\.dxf$/)

  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.getByRole('button', { name: 'PDF study sheet', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Printable study sheet' })).toBeVisible()
  await page.getByRole('button', { name: 'Close study sheet', exact: true }).click()

  await openCity(page)
  await expect(page.locator('.city-picker [role="status"]')).not.toHaveText(/Type at least two letters/)
})
