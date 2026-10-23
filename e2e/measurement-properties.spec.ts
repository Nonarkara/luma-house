import { expect, test } from '@playwright/test'
import { chinaApartmentPlan, CHINA_PROJECT_KEY } from '../src/mockups/chinaApartment'
import { encodePlanToHash } from '../src/sharePlan'
import { chooseTheme } from './workspace'

async function openProperties(page: import('@playwright/test').Page) {
  await page.goto('/#plan=' + encodePlanToHash(chinaApartmentPlan))
  await page.getByRole('button', { name: /^Select Quiet bedroom/ }).click()
  const open = page.getByRole('button', { name: 'Open panel', exact: true })
  if (await open.isVisible()) await open.click()
}

test('stated metres survive scale, reload and Undo; impossible scale changes nothing', async ({ page }, info) => {
  await openProperties(page)
  const width = page.locator('.inspector').getByLabel('Quiet bedroom width in metres', { exact: true })
  await expect(width).toHaveValue('3.92')
  await width.fill('3.4567'); await width.press('Enter')
  await expect(width).toHaveAttribute('data-measurement', 'stated')
  const field = page.getByLabel('Drawing field width in meters', { exact: true })
  await field.fill('20'); await field.press('Tab')
  await expect(width).toHaveValue('3.46')
  const before = await page.locator('button.room').first().getAttribute('style')
  await field.fill('2'); await field.press('Tab')
  await expect(field).toHaveValue('20')
  await expect(page.getByRole('alert').filter({ hasText: 'Scale unchanged' })).toBeVisible()
  expect(await page.locator('button.room').first().getAttribute('style')).toBe(before)
  await page.screenshot({ path: info.outputPath('properties-refused.png') })
  // Merely focusing and blurring a rounded display must not restate it.
  await width.focus(); await width.press('Tab')
  await expect.poll(async () => page.evaluate(key => {
    const plan = JSON.parse(localStorage.getItem(key) ?? '{}')
    return plan.rooms?.[0]?.statedSize?.w
  }, CHINA_PROJECT_KEY)).toBe(3.4567)
  await page.getByRole('button', { name: 'Collapse inspector', exact: true }).click()
  await page.keyboard.press('ControlOrMeta+z')
  await page.getByRole('button', { name: 'Open panel', exact: true }).click()
  await expect(field).toHaveValue('14')
  await expect(width).toHaveAttribute('data-measurement', 'stated')
  await page.reload()
  await page.getByRole('button', { name: /^Select Quiet bedroom/ }).click()
  await page.getByRole('button', { name: 'Open panel', exact: true }).click()
  await expect(width).toHaveValue('3.46')
  await expect(width).toHaveAttribute('data-measurement', 'stated')
})

test('compact property sheet fits the phone and remains contained in every palette', async ({ page }, info) => {
  await openProperties(page)
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    for (const theme of ['drafting-room', 'solar-pop', 'guava-club', 'violet-hour']) {
      const close = page.getByRole('button', { name: 'Collapse inspector', exact: true })
      if (await close.isVisible()) await close.click()
      await chooseTheme(page, theme)
      await page.getByRole('button', { name: /^Select Quiet bedroom/ }).click()
      await page.getByRole('button', { name: 'Open panel', exact: true }).click()
      const panel = page.locator('.inspector--plan')
      await expect(panel).toBeVisible()
      expect(await panel.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
      await expect(panel.getByLabel('Ceiling / Wall Height', { exact: true })).toBeInViewport()
      await expect(panel.locator('.room-calibration-section')).toBeVisible()
      expect(await panel.locator('.inspector-head').evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(56)
      await page.screenshot({ path: info.outputPath(`properties-${width}-${theme}.png`) })
    }
  }
})

test('known-room calibration replaces the reference measurement despite rounded field scale', async ({ page }, info) => {
  await openProperties(page)
  await page.getByRole('button', { name: 'Collapse inspector', exact: true }).click()
  await page.getByRole('button', { name: /^Select South living room/ }).click()
  await page.getByRole('button', { name: 'Open panel', exact: true }).click()
  await page.getByText('Calibrate from a known length', { exact: true }).click()
  const reference = page.getByLabel('Known room width in meters', { exact: true })
  await reference.fill('4.9')
  await page.screenshot({ path: info.outputPath('properties-calibration-open.png') })
  await page.getByRole('button', { name: 'Use width', exact: true }).click()
  const width = page.locator('.inspector').getByLabel('South living room width in metres', { exact: true })
  await expect(width).toHaveValue('4.90')
  await expect(width).toHaveAttribute('data-measurement', 'stated')
  await page.getByLabel('Drawing field width in meters', { exact: true }).fill('15')
  await expect(width).toHaveValue('4.90')
  await expect(width).toHaveAttribute('data-measurement', 'stated')
})
