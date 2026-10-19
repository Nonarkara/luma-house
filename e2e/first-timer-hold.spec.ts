import fs from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { chinaApartmentPlan } from '../src/mockups/chinaApartment'
import { encodePlanToHash } from '../src/sharePlan'

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1440', width: 1440, height: 900 },
] as const

const LANGS = ['en', 'th', 'zh'] as const
type Lang = (typeof LANGS)[number]

const MORE: Record<Lang, string> = { en: 'More actions', th: 'คำสั่งเพิ่ม', zh: '更多操作' }
const SUN_TIME: Record<Lang, string> = { en: 'Inspector sun time', th: 'เวลาแดดในแผง', zh: '面板中的日照时间' }
const PLACE: Record<Lang, string> = { en: 'Place a window', th: 'วางหน้าต่าง', zh: '放置窗户' }

test.describe('play hold fixes', () => {
  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '390, 1280 and 1440 are set inside this spec')
  })

  for (const viewport of VIEWPORTS) {
    for (const lang of LANGS) {
      test(`${viewport.name} ${lang}`, async ({ page }) => {
        test.setTimeout(90_000)
        await page.clock.setFixedTime(new Date('2026-10-19T06:00:00Z'))
        await page.addInitScript((value) => localStorage.setItem('designon:lang', value), lang)
        await page.route('**/geocoding-api.open-meteo.com/**', (route) => route.fulfill({
          json: { results: [{ name: 'Cape Town', admin1: 'Western Cape', country: 'South Africa', latitude: -33.9249, longitude: 18.4241, timezone: 'Africa/Johannesburg' }] },
        }))
        await page.setViewportSize(viewport)
        await page.goto('/#plan=' + encodePlanToHash(chinaApartmentPlan))
        const welcome = page.locator('.welcome-card')
        if (await welcome.isVisible()) await welcome.getByRole('button').nth(1).click()
        await expect.poll(async () => (await page.locator('button.opening').first().boundingBox())?.width ?? 0).toBeGreaterThan(20)
        const openingBox = await page.locator('button.opening').first().evaluate((el) => {
          const rect = el.getBoundingClientRect()
          const style = getComputedStyle(el)
          const canvas = el.closest('.plan-canvas')?.getBoundingClientRect()
          return { w: rect.width, h: rect.height, cssW: style.width, minW: style.minWidth, inline: (el as HTMLElement).style.width, canvasW: canvas?.width }
        })
        expect(openingBox.w, JSON.stringify(openingBox)).toBeGreaterThan(0)

        const scan = await scanButtons(page)
        const stages = await page.locator('.journey-step').evaluateAll((els) => els.map((el) => {
          const span = el.querySelector('span')
          const node = span?.childNodes[0]
          const text = node?.textContent?.trim() ?? ''
          const range = document.createRange()
          if (node) range.selectNodeContents(node)
          return { text, lines: node ? range.getClientRects().length : 0 }
        }))
        const openings = await page.locator('button.opening').evaluateAll((els) => els.map((el) => {
          const box = el.getBoundingClientRect()
          const glyph = el.querySelector('.opening-glyph')?.getBoundingClientRect()
          return {
            type: el.classList.contains('opening-door') ? 'door' : 'window',
            hitW: Math.round(box.width * 10) / 10,
            hitH: Math.round(box.height * 10) / 10,
            glyphW: glyph ? Math.round(glyph.width * 10) / 10 : 0,
            glyphH: glyph ? Math.round(glyph.height * 10) / 10 : 0,
          }
        }))
        fs.mkdirSync('/opt/cursor/artifacts', { recursive: true })
        fs.appendFileSync('/opt/cursor/artifacts/hold-measures.jsonl', JSON.stringify({ viewport: viewport.name, lang, scan, stages, openings }) + '\n')
        expect(scan.empty, JSON.stringify(scan.empty)).toEqual([])
        expect(scan.unnamed, JSON.stringify(scan.unnamed)).toEqual([])
        expect(scan.overflow, JSON.stringify(scan.overflow)).toEqual([])
        expect(stages.every((stage) => stage.lines === 1), JSON.stringify(stages)).toBe(true)

        await page.locator('button.opening').first().dispatchEvent('pointerdown')
        const chip = page.locator('.furniture-chip.is-overlay')
        await expect(chip).toBeVisible()
        const covered = await page.evaluate(() => {
          const status = document.querySelector('.furniture-chip.is-overlay')
          const calibrate = document.querySelector('.ruler-arm')
          if (!status || !calibrate) return { missing: true }
          const a = status.getBoundingClientRect()
          const b = calibrate.getBoundingClientRect()
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          return { overlapX, overlapY }
        })
        expect((covered.overlapX ?? 0) > 0 && (covered.overlapY ?? 0) > 0, JSON.stringify(covered)).toBe(false)
        const more = page.getByRole('button', { name: /More tools|เครื่องมือเพิ่ม|更多工具/ })
        if (await more.count()) {
          await more.click()
          const named = await scanButtons(page)
          expect(named.overflow, JSON.stringify(named.overflow)).toEqual([])
          expect(named.empty, JSON.stringify(named.empty)).toEqual([])
        }
        if (viewport.name === '390') {
          expect(openings.length).toBeGreaterThan(0)
          for (const opening of openings) {
            expect(opening.hitW, JSON.stringify(opening)).toBeGreaterThanOrEqual(44)
            expect(opening.hitH, JSON.stringify(opening)).toBeGreaterThanOrEqual(44)
            expect(opening.glyphW, JSON.stringify(opening)).toBeGreaterThan(0)
          }
        }

        await page.screenshot({ path: `/opt/cursor/artifacts/hold-${viewport.name}-${lang}-plan.png` })
        await page.locator('.journey-step').nth(2).click()
        await expect(page.getByRole('button', { name: PLACE[lang], exact: true })).toHaveCount(0)
        const sunTime = page.getByRole('slider', { name: SUN_TIME[lang], exact: true })
        await expect(sunTime).toHaveValue('14')

        const railPicker = page.locator('.design-stage > .location-workspace')
        await openCity(page, lang)
        await expect(railPicker).toBeVisible()
        await railPicker.getByRole('searchbox').fill('Cape Town')
        await railPicker.getByRole('button', { name: /Cape Town, Western Cape, South Africa/ }).click()
        await expect(railPicker).toBeHidden()
        const stage = page.locator('.journey-step').first()
        const hit = await stage.evaluate((el) => {
          const rect = el.getBoundingClientRect()
          const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + Math.min(rect.height / 2, 20))
          return !!target && (target === el || el.contains(target))
        })
        expect(hit).toBe(true)
        await expect(sunTime).toHaveValue('8')

        await page.locator('.journey-step').nth(5).click()
        await expect(page.locator('.budget-hero strong')).toContainText('ZAR')
        await page.screenshot({ path: `/opt/cursor/artifacts/hold-${viewport.name}-${lang}-cost.png` })

        await page.locator('.view-switch button').nth(1).click()
        await expect(page.locator('.spatial-tb-btn').first()).toBeVisible({ timeout: 25_000 })
        const spatial = await scanButtons(page)
        fs.appendFileSync('/opt/cursor/artifacts/hold-measures.jsonl', JSON.stringify({ viewport: viewport.name, lang, view: 'spatial', scan: spatial }) + '\n')
        expect(spatial.empty, JSON.stringify(spatial.empty)).toEqual([])
        expect(spatial.unnamed, JSON.stringify(spatial.unnamed)).toEqual([])
        expect(spatial.overflow, JSON.stringify(spatial.overflow)).toEqual([])
        await page.screenshot({ path: `/opt/cursor/artifacts/hold-${viewport.name}-${lang}-spatial.png` })

        await page.locator('.view-switch button').nth(2).click()
        await expect(page.locator('.render-thumbs button').first()).toBeVisible()
        const picture = await scanButtons(page)
        fs.appendFileSync('/opt/cursor/artifacts/hold-measures.jsonl', JSON.stringify({ viewport: viewport.name, lang, view: 'picture', scan: picture }) + '\n')
        expect(picture.empty, JSON.stringify(picture.empty)).toEqual([])
        expect(picture.unnamed, JSON.stringify(picture.unnamed)).toEqual([])
        expect(picture.overflow, JSON.stringify(picture.overflow)).toEqual([])
      })
    }
  }
})

async function openCity(page: Page, lang: Lang) {
  const direct = page.locator('.topbar-meta .location-toggle')
  if (await direct.isVisible()) {
    await direct.click()
    return
  }
  await page.getByRole('button', { name: MORE[lang], exact: true }).click()
  await page.locator('.menu-location').click()
}

async function scanButtons(page: Page) {
  return page.evaluate(() => {
    const visible = [...document.querySelectorAll('button')].filter((button) => {
      const rect = button.getBoundingClientRect()
      const style = getComputedStyle(button)
      return rect.width >= 1 && rect.height >= 1 && style.visibility !== 'hidden' && style.display !== 'none'
    })
    const empty: string[] = []
    const unnamed: string[] = []
    const overflow: string[] = []
    for (const button of visible) {
      const name = (button.getAttribute('aria-label') || button.innerText || '').replace(/\s+/g, ' ').trim()
      if (!name) unnamed.push(button.className || button.outerHTML.slice(0, 80))
      const text = button.innerText.replace(/\s+/g, ' ').trim()
      const svg = button.querySelector('svg')
      const svgPaint = !!svg && svg.getBoundingClientRect().width > 0 && svg.getBoundingClientRect().height > 0
        && !!svg.querySelector('path, circle, rect, line, polyline, polygon')
      const style = getComputedStyle(button)
      const fill = style.backgroundColor
      const filled = !!fill && fill !== 'transparent' && fill !== 'rgba(0, 0, 0, 0)'
      if (!text && !svgPaint && !filled) empty.push(name || button.className)
      const drawn = button.classList.contains('room') || button.classList.contains('furniture') || button.classList.contains('opening')
      if (!drawn && button.scrollWidth > button.clientWidth + 1) overflow.push(`${name || button.className} ${button.scrollWidth}>${button.clientWidth}`)
    }
    return { count: visible.length, empty, unnamed, overflow }
  })
}
