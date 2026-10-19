import { test, expect, type Page } from '@playwright/test'
import { clickAction } from './workspace'
import { initialPlan } from '../src/plan'
import { encodePlanToHash } from '../src/sharePlan'
import type { PlanState } from '../src/types'

async function openSheet(page: Page, plan: PlanState) {
  await page.goto('/#plan=' + encodePlanToHash(plan))
  await page.reload()
  await clickAction(page, 'Renders')
  await page.getByRole('button', { name: 'Study sheet', exact: true }).click()
  await page.getByRole('button', { name: 'Elevation sheet', exact: true }).click()
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('svg.drawing-sheet')).toBeVisible()
}

const longNames: PlanState = {
  ...initialPlan,
  rooms: initialPlan.rooms.map((room, i) => ({ ...room, name: `Room ${i + 1} with a long architectural description for the drawing key` })),
}

test('the printed drawing holds one scale whatever the room names say', async ({ page }) => {
  // The defect: the sheet's paper grew with the room key, so the same plan
  // printed at 231.7 mm wide with short names and 220.0 mm with long ones. The
  // axonometric carries no scale bar, so nothing on the drawing said so.
  // Measure the drawn geometry itself. The element's width over the viewBox
  // width would be constant by construction and prove nothing.
  const widths: number[] = []
  for (const plan of [initialPlan, longNames]) {
    await page.emulateMedia({ media: 'screen' })
    await openSheet(page, plan)
    await page.emulateMedia({ media: 'print' })
    await page.waitForTimeout(200)
    widths.push(await page.locator('svg.drawing-sheet').evaluate(svg => {
      const solids = [...svg.querySelectorAll('[data-sheet-solid]')].map(node => node.getBoundingClientRect())
      const left = Math.min(...solids.map(box => box.left))
      const right = Math.max(...solids.map(box => box.right))
      return +((right - left) * 25.4 / 96).toFixed(3)
    }))
  }
  expect(widths[0], 'the axonometric must actually be drawn').toBeGreaterThan(40)
  expect(widths[1], 'the drawn axonometric must print at the same physical width whatever the room names say').toBeCloseTo(widths[0], 1)
})

test('the drawing and its room key print as two A4 landscape sheets', async ({ page }, info) => {
  await openSheet(page, longNames)
  await page.getByLabel('Drawing zoom', { exact: true }).selectOption('3')
  await page.emulateMedia({ media: 'print' })
  for (const note of await page.locator('[data-sheet-note]').allTextContents()) expect(note.length).toBeLessThanOrEqual(65)
  const escaped = await page.locator('svg.drawing-sheet, svg.drawing-sheet-key').evaluateAll(sheets => sheets.flatMap(svg => {
    const bounds = svg.getBoundingClientRect()
    return [...svg.querySelectorAll('text')].filter(text => {
      const box = text.getBoundingClientRect()
      return box.left < bounds.left - 1 || box.right > bounds.right + 1 || box.bottom > bounds.bottom + 1
    }).map(text => text.textContent)
  }))
  expect(escaped, 'all drawing annotations must stay on the paper').toEqual([])
  const pdf = await page.pdf({ path: info.outputPath('elevation.pdf'), preferCSSPageSize: true, printBackground: true })
  expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBe(2)
  const boxes = [...pdf.toString('latin1').matchAll(/\/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(match => [Number(match[1]), Number(match[2])])
  expect(boxes.length).toBe(2)
  for (const [width, height] of boxes) {
    expect(width).toBeCloseTo(841.89, 0)
    expect(height).toBeCloseTo(595.28, 0)
  }
})

for (const fixture of [
  { name: 'partially hidden name', height: 5.3, style: 'Minimalist' },
  { name: 'hidden fallback number', height: 5.5, style: 'Minimalist' },
  { name: 'monospaced name', height: 2.8, style: 'High-tech' },
]) {
  test(`drawing labels use real visible font ink: ${fixture.name}`, async ({ page }) => {
    const mono = fixture.style === 'High-tech'
    await openSheet(page, { ...initialPlan, site: { w: 10, h: 10, unit: 1 }, furniture: [], openings: [], rooms: mono ? [
      { id: 'back', name: 'Utility', kind: 'studio', x: 0, y: 0, w: 20, h: 50, wallHeight: 2.8 },
      { id: 'front', name: 'Main', kind: 'living', x: 0, y: 60, w: 90, h: 35, wallHeight: 2.8 },
    ] : [
      { id: 'back', name: 'Dining', kind: 'living', x: 0, y: 0, w: 50, h: 50, wallHeight: 2.8 },
      { id: 'front', name: 'Kitchen', kind: 'kitchen', x: 50, y: 0, w: 20, h: 55, wallHeight: fixture.height },
    ] })
    await page.getByLabel('Drawing style', { exact: true }).selectOption(fixture.style.toLowerCase())
    await page.evaluate(() => document.fonts.ready)
    const failures = await page.locator('svg.drawing-sheet').evaluate(svg => {
      const context = document.createElement('canvas').getContext('2d')!
      const contains = (x: number, y: number, polygon: number[][]) => {
        let inside = false
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const a = polygon[i], b = polygon[j]
          if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
        }
        return inside
      }
      const points = (value: string) => value.split(' ').map(pair => pair.split(',').map(Number))
      const solids = [...svg.querySelectorAll('[data-sheet-solid]')]
      const errors: string[] = []
      for (const node of svg.querySelectorAll<SVGTextElement>('[data-sheet-label]')) {
        const font = getComputedStyle(node)
        context.font = `${font.fontSize} ${font.fontFamily}`
        const text = node.textContent ?? '', metrics = context.measureText(text)
        const origin = node.x.baseVal[0].value - metrics.width / 2, baseline = node.y.baseVal[0].value
        const face = points(node.getAttribute('data-sheet-face')!)
        const own = solids.findIndex(solid => solid.getAttribute('data-sheet-solid') === node.getAttribute('data-sheet-room-id'))
        const covers = solids.slice(own + 1).flatMap(solid => [...solid.querySelectorAll('polygon')].map(polygon => points(polygon.getAttribute('points')!)))
        // Probe the actual ink rectangle at subpixel resolution, including its
        // corners. This catches partial occlusion and wider monospaced glyphs.
        for (let yy = -metrics.actualBoundingBoxAscent; yy <= metrics.actualBoundingBoxDescent; yy += 0.2) {
          for (let xx = -metrics.actualBoundingBoxLeft; xx <= metrics.actualBoundingBoxRight; xx += 0.2) {
            const x = origin + xx, y = baseline + yy
            if (!contains(x, y, face) || covers.some(polygon => contains(x, y, polygon))) {
              errors.push(text); break
            }
          }
          if (errors.includes(text)) break
        }
      }
      return errors
    })
    expect(failures).toEqual([])
    await expect(page.locator('[data-sheet-key]')).toContainText(mono ? 'Utility' : 'Dining')
    await expect(page.locator('[data-sheet-key]')).toContainText(mono ? 'Main' : 'Kitchen')
    await expect(page.locator('[data-sheet-label]')).not.toHaveCount(0)
  })
}

test('sheet remains inside the dialog at desktop tablet and phone widths', async ({ page }, info) => {
  await openSheet(page, initialPlan)
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    const dialog = page.getByRole('dialog', { name: 'Printable study sheet' })
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: info.outputPath(`sheet-${width}.png`), fullPage: true })
  }
  await page.getByLabel('Drawing zoom', { exact: true }).selectOption('3')
  expect(await page.getByRole('region', { name: 'Drawing sheet preview' }).evaluate(element => element.scrollWidth > element.clientWidth * 2.5)).toBe(true)
  expect(await page.getByRole('dialog', { name: 'Printable study sheet' }).evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath('sheet-390-zoom.png'), fullPage: true })
})
