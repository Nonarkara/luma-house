import { expect, test, type Page } from '@playwright/test'
import { chinaApartmentPlan } from '../src/mockups/chinaApartment'
import { encodePlanToHash } from '../src/sharePlan'

/**
 * Stating the real size of a room.
 *
 * The drawing field has one scale, and that scale comes from a single known
 * measurement. Every other length on the sheet is that scale applied to a
 * rough line — an estimate wearing a measurement's clothes. There was no way
 * to correct one: a room's size could only be typed in the Inspector, in a
 * field that rounded to a tenth of a metre on every keystroke.
 *
 * These gates drive the real gesture: type the length you know, and the room
 * becomes that long. The edge it was drawn from stays put and the far edge
 * moves.
 *
 * Where the control lives depends on the screen, and the reason is measured:
 * the band above the drawing carries it wherever the band can carry it, and
 * on a phone the band cannot (it grows from 44px to 102px and takes 52px from
 * a 423px drawing), so the panel does.
 */

const namedHash = encodePlanToHash(chinaApartmentPlan)
// The test plan runs on the default 14 × 10 m field.
const FIELD_W = 14
const FIELD_H = 10

async function openStudio(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
  await page.goto(`/#plan=${namedHash}`)
  await expect(page.locator('.app-shell')).toBeVisible()
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 700

/** The room's rectangle, in the percentages the plan itself uses. */
async function roomRect(page: Page, index: number) {
  return page.locator('.room').nth(index).evaluate(el => {
    const style = (el as HTMLElement).style
    return {
      x: parseFloat(style.left), y: parseFloat(style.top),
      w: parseFloat(style.width), h: parseFloat(style.height),
    }
  })
}

/** Select a room from the key beside the drawing. */
async function selectRoom(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(`^Select ${name}`) }).click()
  await expect(page.locator('.contextual-action-bar')).toBeVisible()
}

/**
 * The size control for one axis of a room. In the band above the drawing
 * where the band can carry it; in the panel where it cannot.
 */
async function sizeField(page: Page, room: string, axis: 'width' | 'depth') {
  const label = `${room} ${axis} in metres`
  const inBand = page.locator('.contextual-size').getByLabel(label)
  if (await inBand.count() > 0 && await inBand.first().isVisible()) return inBand.first()
  const open = page.getByRole('button', { name: 'Open panel', exact: true })
  if (await open.isVisible()) await open.click()
  const inPanel = page.locator('.inspector').getByLabel(label)
  await inPanel.waitFor({ state: 'visible' })
  return inPanel
}

test.describe('stating the real size of a room', () => {
  test('the room\'s real size is on screen', async ({ page }) => {
    await openStudio(page)
    await selectRoom(page, 'Quiet bedroom')
    // The bedroom is 28% of 14 m wide and 25% of 10 m deep.
    await expect(await sizeField(page, 'Quiet bedroom', 'width')).toHaveValue('3.92')
    await expect(await sizeField(page, 'Quiet bedroom', 'depth')).toHaveValue('2.50')
  })

  test('typing a length moves the far edge and the area follows', async ({ page }) => {
    await openStudio(page)
    await selectRoom(page, 'Quiet bedroom')
    const before = await roomRect(page, 0)

    const input = await sizeField(page, 'Quiet bedroom', 'width')
    await input.fill('4.20')
    await input.press('Enter')

    const after = await roomRect(page, 0)
    expect(after.x, 'the edge it was drawn from stays put').toBeCloseTo(before.x, 6)
    expect(after.w, 'the far edge moved to the length that was stated').toBeCloseTo((4.2 / FIELD_W) * 100, 6)
    expect(after.w).toBeGreaterThan(before.w)

    await expect(await sizeField(page, 'Quiet bedroom', 'width')).toHaveValue('4.20')
    await expect(page.locator('.contextual-action-area')).toHaveText('10.5 m²')
    await expect(page.locator('.plan-room-key .room-area').first()).toHaveText('10.5 m²')
  })

  test('a depth can be stated too, and the width is not touched', async ({ page }) => {
    await openStudio(page)
    await selectRoom(page, 'Quiet bedroom')
    const before = await roomRect(page, 0)

    const input = await sizeField(page, 'Quiet bedroom', 'depth')
    await input.fill('3')
    await input.press('Enter')

    const after = await roomRect(page, 0)
    expect(after.y, 'the top edge stays put').toBeCloseTo(before.y, 6)
    expect(after.h).toBeCloseTo((3 / FIELD_H) * 100, 6)
    expect(after.w, 'the width was not touched').toBeCloseTo(before.w, 6)
  })

  test('the keyboard does the same work as the mouse', async ({ page }) => {
    await openStudio(page)
    await selectRoom(page, 'Quiet bedroom')
    const before = await roomRect(page, 0)

    const input = await sizeField(page, 'Quiet bedroom', 'width')
    await input.focus()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('3.50')
    await page.keyboard.press('Enter')

    const after = await roomRect(page, 0)
    expect(after.w).toBeCloseTo((3.5 / FIELD_W) * 100, 6)
    expect(after.x).toBeCloseTo(before.x, 6)
  })

  test('a length that cannot be drawn is refused and the drawing does not change', async ({ page }) => {
    await openStudio(page)
    await selectRoom(page, 'Quiet bedroom')
    const before = await roomRect(page, 0)

    const input = await sizeField(page, 'Quiet bedroom', 'width')
    await input.fill('99')
    await input.press('Enter')

    await expect(page.locator('.toast')).toContainText('drawing field')
    const after = await roomRect(page, 0)
    expect(after.w, 'a refused length changes nothing').toBeCloseTo(before.w, 6)
    expect(after.x).toBeCloseTo(before.x, 6)
    // The figure must not keep a number the room does not have.
    await expect(await sizeField(page, 'Quiet bedroom', 'width')).toHaveValue('3.92')
  })

  test('a length that fits the field but not the room\'s place is refused', async ({ page }) => {
    await openStudio(page)
    // The bath sits at x = 61.75% of a 14 m field, so a 6 m width fits the
    // field but not the room's place. That is the fit rule, not the field rule.
    await selectRoom(page, 'Dry / wet bath')
    const before = await roomRect(page, 2)

    const input = await sizeField(page, 'Dry / wet bath', 'width')
    await input.fill('6')
    await input.press('Enter')

    await expect(page.locator('.toast')).toContainText('move the room first')
    const after = await roomRect(page, 2)
    expect(after.w, 'a refused length changes nothing').toBeCloseTo(before.w, 6)
    expect(after.x).toBeCloseTo(before.x, 6)
  })

  test('a length is refused when it is not a length at all', async ({ page }) => {
    await openStudio(page)
    await selectRoom(page, 'Quiet bedroom')
    const before = await roomRect(page, 0)

    const input = await sizeField(page, 'Quiet bedroom', 'width')
    await input.fill('wide')
    await input.press('Enter')

    await expect(page.locator('.toast')).toContainText('not a length')
    const after = await roomRect(page, 0)
    expect(after.w).toBeCloseTo(before.w, 6)
    await expect(await sizeField(page, 'Quiet bedroom', 'width')).toHaveValue('3.92')
  })

  test('a length that is typed and then left alone is still stated', async ({ page }) => {
    await openStudio(page)
    await selectRoom(page, 'Quiet bedroom')
    const before = await roomRect(page, 0)

    const input = await sizeField(page, 'Quiet bedroom', 'width')
    await input.fill('4.20')
    // Walk away from the figure without pressing Enter.
    await (await sizeField(page, 'Quiet bedroom', 'depth')).focus()

    const after = await roomRect(page, 0)
    expect(after.w).toBeCloseTo((4.2 / FIELD_W) * 100, 6)
    expect(after.x).toBeCloseTo(before.x, 6)
  })

  test('a half-typed length is put back without a fuss', async ({ page }) => {
    await openStudio(page)
    await selectRoom(page, 'Quiet bedroom')
    const before = await roomRect(page, 0)

    const input = await sizeField(page, 'Quiet bedroom', 'width')
    await input.fill('4.')
    await (await sizeField(page, 'Quiet bedroom', 'depth')).focus()

    await expect(page.locator('.toast')).toHaveCount(0)
    const after = await roomRect(page, 0)
    expect(after.w).toBeCloseTo(before.w, 6)
    await expect(await sizeField(page, 'Quiet bedroom', 'width')).toHaveValue('3.92')
  })

  test('a stated length is read as a length, whatever units it is written in', async ({ page }) => {
    await openStudio(page)
    await selectRoom(page, 'Quiet bedroom')

    const input = await sizeField(page, 'Quiet bedroom', 'width')
    await input.fill('560cm')
    await input.press('Enter')

    await expect(await sizeField(page, 'Quiet bedroom', 'width')).toHaveValue('5.60')
    const after = await roomRect(page, 0)
    expect(after.w).toBeCloseTo((5.6 / FIELD_W) * 100, 6)
  })

  test('the size control is never inside the drawing', async ({ page }) => {
    // The band carries the size only where the band can carry it.
    test.skip(isPhone(page), 'a phone states the length in the panel')
    await openStudio(page)
    await selectRoom(page, 'Quiet bedroom')
    const plot = await page.locator('.plan-viewport').boundingBox()
    const size = await page.locator('.contextual-size').boundingBox()
    expect(size!.y + size!.height).toBeLessThanOrEqual(plot!.y)
    const input = await page.locator('.contextual-size').getByLabel('Quiet bedroom width in metres').boundingBox()
    expect(input!.height, 'the figure is a real touch target').toBeGreaterThanOrEqual(44)
  })
})

test.describe('on a phone', () => {
  test('the panel states the length, because the band cannot', async ({ page }) => {
    test.skip(!isPhone(page), 'a phone only')
    await openStudio(page)
    await selectRoom(page, 'Quiet bedroom')
    // The band above the drawing cannot carry the size on a phone, so the
    // panel does — and it is the same control.
    await expect(page.locator('.contextual-size')).toBeHidden()

    const input = await sizeField(page, 'Quiet bedroom', 'width')
    await expect(input).toHaveValue('3.92')
    await input.fill('4.20')
    await input.press('Enter')

    const after = await roomRect(page, 0)
    expect(after.w).toBeCloseTo((4.2 / FIELD_W) * 100, 6)
    expect(after.x).toBeCloseTo(18.75, 6)
    await expect(input).toHaveValue('4.20')
  })

  test('the band does not grow to carry the size', async ({ page }) => {
    test.skip(!isPhone(page), 'a phone only')
    await openStudio(page)
    await selectRoom(page, 'Quiet bedroom')
    // The band carries the size only where it fits. On a phone it would grow
    // from 58px to 102px and the drawing would lose 52px of its 423px.
    const band = await page.locator('.contextual-action-bar').boundingBox()
    expect(band!.height).toBeLessThanOrEqual(60)
  })
})
