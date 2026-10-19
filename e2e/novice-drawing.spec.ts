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
    for (const name of ['Pencil', 'Window', 'Door', 'Select', 'Undo', 'More tools']) {
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

test('a wall click with the Window · Door chip open places the next window', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)
  await clickTool(page, 'Room')
  const sheet = await page.locator('.plan-canvas').boundingBox()
  await page.mouse.move(sheet!.x + sheet!.width * 0.25, sheet!.y + sheet!.height * 0.22)
  await page.mouse.down()
  await page.mouse.move(sheet!.x + sheet!.width * 0.75, sheet!.y + sheet!.height * 0.78, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('button.room')).toHaveCount(1)

  await page.locator('.canvas-tools').getByRole('button', { name: 'Window', exact: true }).click()
  const room = await page.locator('button.room').boundingBox()
  await page.mouse.click(room!.x + room!.width / 2, room!.y + 2)
  await expect(page.locator('button.opening-window')).toHaveCount(1)
  await expect(page.locator('.opening-slot:not(.is-reserved)')).toBeVisible()

  const host = await page.locator('button.room').boundingBox()
  await page.mouse.click(host!.x + host!.width / 2, host!.y + host!.height - 2)
  await expect(page.locator('button.opening-window')).toHaveCount(2)
  await expect(page.locator('button.opening-window[data-rotation="0"]')).toHaveCount(2)
})

test('one overshot pencil loop is a single room', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(400)
  const canvas = page.locator('.plan-canvas')
  const box = await canvas.boundingBox()
  const view = page.viewportSize()!
  const left = Math.max(box!.x, 8)
  const top = Math.max(box!.y, 8)
  const right = Math.min(box!.x + box!.width, view.width - 8)
  const bottom = Math.min(box!.y + box!.height, view.height - 8)
  const overM = view.width <= 720 ? 0.5 : 0.7
  const pxPerMx = box!.width / 14
  const pxPerMy = box!.height / 10
  const ox = overM * pxPerMx
  const oy = overM * pxPerMy
  const margin = Math.max(ox, oy) + 16
  const x1 = left + margin
  const x2 = right - margin
  const y1 = top + margin
  const y2 = bottom - margin
  expect(x2 - x1).toBeGreaterThan(80)
  expect(y2 - y1).toBeGreaterThan(60)
  const line = async (ax: number, ay: number, bx: number, by: number) => {
    await page.mouse.move(ax, ay)
    await page.mouse.down()
    await page.mouse.move(bx, by, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(60)
  }
  await line(x1 - ox, y1, x2 + ox, y1)
  await line(x2, y1 - oy, x2, y2 + oy)
  await line(x2 + ox, y2, x1 - ox, y2)
  await line(x1, y2 + oy, x1, y1 - oy)
  await expect(page.locator('button.room')).toHaveCount(1)
  await expect(page.locator('.overlap-warning')).toHaveCount(0)
  await expect(page.locator('.napkin-wall')).toHaveCount(0)
  const label = (await page.locator('button.room').getAttribute('aria-label')) ?? ''
  const area = Number(label.match(/([\d.]+) square meters/)?.[1] ?? '0')
  const innerArea = ((x2 - x1) / box!.width) * 14 * ((y2 - y1) / box!.height) * 10
  expect(area).toBeGreaterThan(innerArea * 0.75)
  expect(area).toBeLessThan(innerArea * 1.2)
})

test('every wall accepts a window after one is already on the right', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(400)
  await clickTool(page, 'Room')
  const sheet = await page.locator('.plan-canvas').boundingBox()
  await page.mouse.move(sheet!.x + sheet!.width * 0.22, sheet!.y + sheet!.height * 0.2)
  await page.mouse.down()
  await page.mouse.move(sheet!.x + sheet!.width * 0.78, sheet!.y + sheet!.height * 0.78, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('button.room')).toHaveCount(1)

  await page.locator('.canvas-tools').getByRole('button', { name: 'Window', exact: true }).click()
  const before = await page.locator('button.room').boundingBox()
  const right = { x: before!.x + before!.width - 2, y: before!.y + before!.height / 2 }
  const bottom = { x: before!.x + before!.width / 2, y: before!.y + before!.height - 2 }
  const top = { x: before!.x + before!.width / 2, y: before!.y + 2 }
  const left = { x: before!.x + 2, y: before!.y + before!.height / 2 }
  await page.mouse.click(right.x, right.y)
  await expect(page.locator('button.opening-window')).toHaveCount(1)
  await expect(page.locator('.opening-slot:not(.is-reserved)')).toBeVisible()

  const settled = await page.locator('button.room').boundingBox()
  expect(Math.abs((settled!.y + settled!.height) - (before!.y + before!.height))).toBeLessThan(8)

  await page.mouse.click(bottom.x, bottom.y)
  await expect(page.locator('.wall-note')).toHaveCount(0)
  await expect(page.locator('button.opening-window')).toHaveCount(2)
  await page.mouse.click(bottom.x - Math.min(36, before!.width / 4), bottom.y)
  await expect(page.locator('.wall-note')).toHaveCount(0)
  await expect(page.locator('button.opening-window[data-rotation="0"]')).toHaveCount(2)

  await page.mouse.click(top.x, top.y)
  await page.mouse.click(left.x, left.y)
  await expect(page.locator('.wall-note')).toHaveCount(0)
  await expect(page.locator('button.opening-window')).toHaveCount(5)
  const rotations = await page.locator('button.opening-window').evaluateAll((els) => els.map((el) => el.getAttribute('data-rotation')).sort())
  expect(rotations).toEqual(['0', '0', '0', '90', '90'])
})

test('Escape leaves only Select active in the tool rail', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(300)
  const tools = page.locator('.canvas-tools')
  const windowTool = tools.getByRole('button', { name: 'Window', exact: true })
  const selectTool = tools.getByRole('button', { name: 'Select', exact: true })
  await windowTool.click()
  await expect(windowTool).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(tools.locator('[aria-pressed="true"]')).toHaveCount(1)
  await expect(selectTool).toHaveAttribute('aria-pressed', 'true')
  await expect(windowTool).toHaveAttribute('aria-pressed', 'false')
  await expect(windowTool).not.toBeFocused()
  await expect(selectTool).toBeFocused()
})
