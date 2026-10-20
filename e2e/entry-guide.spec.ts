import { expect, test } from '@playwright/test'
import { initialPlan } from '../src/plan'
import { CHINA_PROJECT_KEY } from '../src/mockups/chinaApartment'
import { encodePlanToHash } from '../src/sharePlan'
import { clickAction, closeInspector } from './workspace'

const title = 'A home, from the first line.'

test('illustrated guide fits one landscape view and reflows on phones', async ({ page }, info) => {
  const expensive: string[] = []
  page.on('request', request => {
    if (/Spatial3D-|luma-concept-render/.test(request.url())) expensive.push(request.url())
  })
  await page.goto('/')
  const guide = page.getByRole('dialog', { name: title })
  await expect(guide).toBeVisible()
  await expect(guide.getByRole('listitem')).toHaveCount(4)
  await expect(guide.locator('.guide-callout text')).toHaveText(['1', '2', '3', '4'])
  await page.evaluate(() => document.fonts.ready)
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844]]) {
    await page.setViewportSize({ width, height })
    await page.screenshot({ path: info.outputPath(`guide-${width}.png`), fullPage: true })
    expect(await guide.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    if (width >= 1024) expect(await guide.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1)
    for (const button of await guide.getByRole('button').all()) {
      const box = await button.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
    if (width === 390) {
      await guide.evaluate(element => { element.scrollTop = element.scrollHeight })
      await expect(guide.getByRole('button', { name: 'Start from a blank page', exact: true })).toBeInViewport()
      await page.screenshot({ path: info.outputPath('guide-390-bottom.png'), fullPage: true })
    }
  }
  expect(expensive).toEqual([])
})

test('guide contains keyboard focus and starts a blank drawing', async ({ page }) => {
  await page.goto('/')
  const guide = page.getByRole('dialog', { name: title })
  await expect(guide.getByRole('heading', { name: title })).toBeFocused()
  await page.locator('.view-switch button').first().evaluate(element => (element as HTMLButtonElement).focus())
  await expect(guide.getByRole('heading', { name: title })).toBeFocused()
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab')
    // Chromium can put focus on browser chrome (activeElement is body),
    // but the workspace behind a native modal must never receive it.
    expect(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest('dialog.assembly-guide'))).toBe(true)
    expect(await guide.evaluate(element => element.matches(':modal'))).toBe(true)
  }
  await guide.getByRole('button', { name: 'Start from a blank page', exact: true }).click()
  await expect(guide).toHaveCount(0)
  expect(new URL(page.url()).searchParams.get('studio')).toBe('1')
  await expect(page.locator('button.room')).toHaveCount(0)
  await page.reload()
  await expect(guide).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add room', exact: true })).toBeVisible()
})

test('returning and shared drawings survive guide entry resume and Escape', async ({ page }) => {
  await page.goto('/#plan=' + encodePlanToHash(initialPlan))
  await expect(page.locator('.assembly-guide')).toHaveCount(0)
  await expect(page.locator('button.room')).toHaveCount(initialPlan.rooms.length)
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), CHINA_PROJECT_KEY)
  await expect.poll(async () => (await saved()).rooms?.length).toBe(initialPlan.rooms.length)
  const before = await saved()
  await page.goto('/')
  await page.getByRole('button', { name: 'Continue your drawing', exact: true }).click()
  expect(await saved()).toEqual(before)
  await clickAction(page, 'Getting started guide')
  await expect(page.getByRole('dialog', { name: title })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.assembly-guide')).toHaveCount(0)
  await expect(page.locator('button.room')).toHaveCount(initialPlan.rooms.length)
  expect(await saved()).toEqual(before)
})

test('the landing sheet is Bauhaus, and the studio keeps its one amber accent', async ({ page }) => {
  await page.goto('/')
  const guide = page.getByRole('dialog', { name: title })
  await expect(guide).toBeVisible()

  // The key line is the palette made visible: red, blue, yellow.
  const chips = guide.locator('.guide-chip')
  await expect(chips).toHaveText(['Draw', 'Measure', 'Sun'])
  const fills = await chips.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor))
  expect(fills).toEqual(['rgb(214, 43, 31)', 'rgb(23, 69, 143)', 'rgb(246, 195, 27)'])

  // The palette belongs to the landing sheet alone. On :root it would be one
  // step away from the studio chrome, which is still allowed exactly one accent.
  const scope = await page.evaluate(() => ({
    root: getComputedStyle(document.documentElement).getPropertyValue('--bau-red').trim(),
    sheet: getComputedStyle(document.querySelector('dialog.assembly-guide')!).getPropertyValue('--bau-red').trim(),
  }))
  expect(scope.root).toBe('')
  expect(scope.sheet).toBe('#d62b1f')

  await page.goto('/?studio=1')
  const studio = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const banned = ['rgb(214, 43, 31)', 'rgb(23, 69, 143)', 'rgb(246, 195, 27)']
    const hits: string[] = []
    for (const node of Array.from(document.querySelectorAll('body *'))) {
      const style = getComputedStyle(node)
      for (const value of [style.color, style.backgroundColor, style.borderTopColor]) {
        if (banned.includes(value)) hits.push(`${node.className || node.tagName} · ${value}`)
      }
    }
    return {
      accent: root.getPropertyValue('--accent-primary').trim(),
      action: root.getPropertyValue('--studio-sienna').trim(),
      hits,
    }
  })
  // The studio keeps exactly one accent, the theme's own action colour, and
  // never a Bauhaus primary. The landing palette stops at the sheet.
  expect(studio.accent).toBe(studio.action)
  expect(['#d62b1f', '#17458f', '#f6c31b']).not.toContain(studio.action)
  expect(studio.hits).toEqual([])
})

test('the pull-out guide prints on one A4 landscape page', async ({ page }, info) => {
  await page.goto('/')
  await expect(page.getByRole('dialog', { name: title })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.emulateMedia({ media: 'print' })
  const pdf = await page.pdf({ path: info.outputPath('getting-started.pdf'), preferCSSPageSize: true, printBackground: true })
  expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBe(1)
})

test('guide replacement clears a photo-only underlay and Undo restores it', async ({ page }) => {
  await page.goto('/?studio=1')
  await page.getByRole('button', { name: 'Open panel', exact: true }).click()
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1kAAAAASUVORK5CYII=', 'base64')
  await page.locator('input[accept="image/*"]').setInputFiles({ name: 'plan.png', mimeType: 'image/png', buffer: image })
  const underlay = page.locator('.sketch-underlay')
  await expect(underlay).toBeAttached()
  await closeInspector(page)
  await clickAction(page, 'Getting started guide')
  await expect(page.getByRole('button', { name: 'Continue your drawing', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Start from a blank page', exact: true }).click()
  await expect(underlay).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(underlay).toBeAttached()
  await closeInspector(page)
  await clickAction(page, 'Getting started guide')
  await page.getByRole('button', { name: 'Explore the 50 m² sample', exact: true }).click()
  await expect(underlay).toHaveCount(0)
  await expect(page.locator('button.room')).toHaveCount(6)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(underlay).toBeAttached()
  await expect(page.locator('button.room')).toHaveCount(0)
})
