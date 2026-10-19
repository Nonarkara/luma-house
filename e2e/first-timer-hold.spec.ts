import fs from 'node:fs'
import path from 'node:path'
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
const RENDERS: Record<Lang, string> = { en: 'Renders', th: 'ภาพเรนเดอร์', zh: '渲染' }
const SUN_TIME: Record<Lang, string> = { en: 'Inspector sun time', th: 'เวลาแดดในแผง', zh: '面板中的日照时间' }
const PLACE: Record<Lang, string> = { en: 'Place a window', th: 'วางหน้าต่าง', zh: '放置窗户' }
const WINDOW_TOOL: Record<Lang, string> = { en: 'Window', th: 'หน้าต่าง', zh: '窗' }
const ROOM_TOOL: Record<Lang, string> = { en: 'Room', th: 'ห้อง', zh: '房间' }
const DOOR_TOOL: Record<Lang, string> = { en: 'Door', th: 'ประตู', zh: '门' }
const SELECT_TOOL: Record<Lang, string> = { en: 'Select', th: 'เลือก', zh: '选择' }
const OPEN_PANEL: Record<Lang, string> = { en: 'Open panel', th: 'เปิดแผง', zh: '打开面板' }
const CLOSE_PANEL: Record<Lang, string> = { en: 'Close panel', th: 'ปิดแผง', zh: '关闭面板' }
const STRIP_HINT: Record<Lang, string> = {
  en: 'Drag along the wall · Delete key removes',
  th: 'ลากไปตามผนัง · ปุ่มลบเอาออก',
  zh: '沿墙拖动 · Delete 键移除',
}
const HOLD_DIR = path.join('test-results', 'hold')

test.describe('play hold fixes', () => {
  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '390, 1280 and 1440 are set inside this spec')
  })

  for (const viewport of VIEWPORTS) {
    for (const lang of LANGS) {
      test(`${viewport.name} ${lang}`, async ({ page }) => {
        test.setTimeout(120_000)
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
        const planWidths = viewport.name === '390' ? null : await stablePlanWidth(page, lang)
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
        fs.mkdirSync(HOLD_DIR, { recursive: true })
        fs.appendFileSync(path.join(HOLD_DIR, 'hold-measures.jsonl'), JSON.stringify({ viewport: viewport.name, lang, scan, stages, openings, planWidths }) + '\n')
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
        const onSheet = await page.evaluate(() => {
          const clip = (el: Element) => {
            const raw = el.getBoundingClientRect()
            let left = raw.left
            let top = raw.top
            let right = raw.right
            let bottom = raw.bottom
            let node = el.parentElement
            while (node) {
              const style = getComputedStyle(node)
              const clips = [style.overflow, style.overflowX, style.overflowY].some((value) => value === 'hidden' || value === 'clip' || value === 'auto' || value === 'scroll')
              if (clips) {
                const box = node.getBoundingClientRect()
                left = Math.max(left, box.left)
                top = Math.max(top, box.top)
                right = Math.min(right, box.right)
                bottom = Math.min(bottom, box.bottom)
              }
              node = node.parentElement
            }
            return { left, top, right, bottom }
          }
          const status = document.querySelector('.furniture-chip.is-overlay')
          const sheet = document.querySelector('.plan-canvas')
          if (!status || !sheet) return { missing: true }
          const a = clip(status)
          const b = clip(sheet)
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          return { overlapX, overlapY }
        })
        expect((onSheet.overlapX ?? 0) > 1 && (onSheet.overlapY ?? 0) > 1, JSON.stringify(onSheet)).toBe(false)
        const more = page.getByRole('button', { name: /More tools|เครื่องมือเพิ่ม|更多工具/ })
        if (await more.count()) {
          await more.click()
          const roomTool = page.getByRole('button', { name: ROOM_TOOL[lang], exact: true })
          await expect(roomTool).toBeVisible()
          const roomHit = await roomTool.evaluate((el) => {
            const rect = el.getBoundingClientRect()
            const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
            return !!target && (target === el || el.contains(target))
          })
          expect(roomHit, 'More tools item is covered').toBe(true)
          const named = await scanButtons(page)
          expect(named.overflow, JSON.stringify(named.overflow)).toEqual([])
          expect(named.empty, JSON.stringify(named.empty)).toEqual([])
          if (viewport.name === '390') await page.screenshot({ path: `${HOLD_DIR}/hold-${viewport.name}-${lang}-more.png` })
          await more.click()
        }
        expect(openings.length).toBeGreaterThan(0)
        for (const opening of openings) {
          expect(opening.hitW, JSON.stringify(opening)).toBeGreaterThanOrEqual(44)
          expect(opening.hitH, JSON.stringify(opening)).toBeGreaterThanOrEqual(44)
          expect(opening.glyphW, JSON.stringify(opening)).toBeGreaterThan(0)
          expect(opening.glyphH, JSON.stringify(opening)).toBeGreaterThan(0)
        }
        if (lang !== 'en') {
          const labels = await page.locator('button.room, button.opening, .plan-room-key, .plan-room-key button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''))
          expect(labels.join('\n')).not.toMatch(/square meters| opening /)
        }
        if (viewport.name !== '390') {
          const city = page.locator('.topbar-meta .location-toggle')
          const cityText = (await city.innerText()).trim()
          expect(cityText).toBe('Shanghai')
          expect(await clippedByAncestor(city)).toBe(false)
          const title = page.locator('.project-picker strong')
          const titleText = (await title.innerText()).trim()
          expect(titleText.endsWith('…') || titleText.endsWith('...'), titleText).toBe(false)
          expect(await clippedByAncestor(title), titleText).toBe(false)
          expect(planWidths?.initial).toBe(viewport.name === '1280' ? 618 : 758)
          const overlap = await walkModes(page, viewport.name, lang)
          fs.appendFileSync(path.join(HOLD_DIR, 'hold-measures.jsonl'), JSON.stringify({ viewport: viewport.name, lang, overlap }) + '\n')
          expect(overlap.collisions, JSON.stringify(overlap)).toEqual([])
          expect(overlap.drawWidth).toBe(planWidths?.initial)
          expect(overlap.restoredWidth).toBe(planWidths?.initial)
          expect(overlap.panelOnDraw).toBe(0)
          const badge = overlap.badge
          expect(badge.spills, JSON.stringify(badge)).toEqual([])
          expect(badge.count).toBeGreaterThan(0)
        }
        if (viewport.name === '390') {
          const roomList = page.locator('.plan-room-key button').first()
          const dock = page.locator('.canvas-tools')
          const roomFit = await roomList.evaluate((button) => {
            const dock = document.querySelector('.canvas-tools')
            const area = button.querySelector('.room-area')
            if (!dock || !area) return { missing: true }
            const room = button.getBoundingClientRect()
            const dockBox = dock.getBoundingClientRect()
            const areaBox = area.getBoundingClientRect()
            return {
              roomBottom: room.bottom,
              dockTop: dockBox.top,
              areaTop: areaBox.top,
              areaBottom: areaBox.bottom,
              areaText: area.textContent?.trim() ?? '',
            }
          })
          expect(roomFit.missing, JSON.stringify(roomFit)).toBeFalsy()
          expect(roomFit.roomBottom, JSON.stringify(roomFit)).toBeLessThanOrEqual(roomFit.dockTop! + 0.5)
          expect(roomFit.areaBottom, JSON.stringify(roomFit)).toBeLessThanOrEqual(roomFit.roomBottom! + 0.5)
          expect(roomFit.areaTop, JSON.stringify(roomFit)).toBeGreaterThanOrEqual((roomFit.roomBottom! - 48))
          expect(roomFit.areaText, JSON.stringify(roomFit)).toMatch(/m²/)
          await page.getByRole('button', { name: MORE[lang], exact: true }).click()
          const theme = page.locator('.top-more-menu select')
          await expect(theme).toBeVisible()
          const themeFit = await theme.evaluate((el) => ({ over: el.scrollWidth > el.clientWidth + 1, text: (el as HTMLSelectElement).selectedOptions[0]?.textContent ?? '' }))
          expect(themeFit.over, themeFit.text).toBe(false)
          const themeHit = await theme.evaluate((el) => {
            const rect = el.getBoundingClientRect()
            const target = document.elementFromPoint(rect.x + Math.min(24, rect.width / 2), rect.y + rect.height / 2)
            return !!target && (target === el || el.contains(target))
          })
          expect(themeHit, 'header More menu is under the opening strip').toBe(true)
          const labelLines = await page.locator('.top-more-menu .theme-picker > span').evaluate((el) => {
            const range = document.createRange()
            range.selectNodeContents(el)
            return range.getClientRects().length
          })
          expect(labelLines).toBe(1)
          await page.keyboard.press('Escape')
        }

        await page.screenshot({ path: `${HOLD_DIR}/hold-${viewport.name}-${lang}-plan.png` })
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
        await page.screenshot({ path: `${HOLD_DIR}/hold-${viewport.name}-${lang}-cost.png` })
        if (viewport.name === '390') {
          await page.locator('.journey-step').nth(0).click()
          await expect(page.locator('.inspector')).toHaveCount(0)
          const toolHit = await page.locator('.canvas-tools').evaluate((el) => {
            const rect = el.getBoundingClientRect()
            const target = document.elementFromPoint(rect.x + 20, rect.y + rect.height / 2)
            return !!target && (target === el || el.contains(target))
          })
          expect(toolHit, 'plan sheet covers the toolbar').toBe(true)
        }

        await page.locator('.view-switch button').nth(1).click()
        await expect(page.locator('.spatial-tb-btn').first()).toBeVisible({ timeout: 25_000 })
        const spatialFit = await page.evaluate(() => {
          const bar = document.querySelector('.spatial-toolbar')!.getBoundingClientRect()
          const hud = document.querySelector('.spatial-sun-hud')!.getBoundingClientRect()
          const label = document.querySelector('.spatial-section-label')!
          const value = document.querySelector('.spatial-section-value')!
          const lines = (el: Element) => {
            const range = document.createRange()
            range.selectNodeContents(el)
            const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)))
            return tops.size
          }
          const overlaps = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
          return {
            barH: Math.round(bar.height * 10) / 10,
            hudCovered: overlaps(bar, hud),
            labelLines: lines(label),
            valueLines: lines(value),
            valueText: value.textContent?.trim() ?? '',
          }
        })
        fs.appendFileSync(path.join(HOLD_DIR, 'hold-measures.jsonl'), JSON.stringify({ viewport: viewport.name, lang, spatialFit }) + '\n')
        expect(spatialFit.barH).toBeLessThanOrEqual(56)
        expect(spatialFit.hudCovered).toBe(false)
        expect(spatialFit.labelLines).toBe(1)
        expect(spatialFit.valueLines).toBe(1)
        const spatial = await scanButtons(page)
        fs.appendFileSync(path.join(HOLD_DIR, 'hold-measures.jsonl'), JSON.stringify({ viewport: viewport.name, lang, view: 'spatial', scan: spatial }) + '\n')
        expect(spatial.empty, JSON.stringify(spatial.empty)).toEqual([])
        expect(spatial.unnamed, JSON.stringify(spatial.unnamed)).toEqual([])
        expect(spatial.overflow, JSON.stringify(spatial.overflow)).toEqual([])
        await page.screenshot({ path: `${HOLD_DIR}/hold-${viewport.name}-${lang}-spatial.png` })

        const rendersInBar = page.locator('.view-switch button').nth(2)
        if (await rendersInBar.count()) await rendersInBar.click()
        else {
          await page.getByRole('button', { name: MORE[lang], exact: true }).click()
          await page.getByRole('button', { name: RENDERS[lang], exact: true }).click()
        }
        await expect(page.locator('.render-thumbs button').first()).toBeVisible()
        await expect(page.locator('.render-stage.is-local-study .spatial-orbit-note')).toBeVisible()
        const navNote = await page.evaluate(() => {
          const nav = document.querySelector('.render-stage.is-local-study .render-nav')!.getBoundingClientRect()
          const note = document.querySelector('.render-stage.is-local-study .spatial-orbit-note')!.getBoundingClientRect()
          const overlapX = Math.min(nav.right, note.right) - Math.max(nav.left, note.left)
          const overlapY = Math.min(nav.bottom, note.bottom) - Math.max(nav.top, note.top)
          return { overlapX, overlapY }
        })
        expect(navNote.overlapX > 1 && navNote.overlapY > 1, JSON.stringify(navNote)).toBe(false)
        const picture = await scanButtons(page)
        fs.appendFileSync(path.join(HOLD_DIR, 'hold-measures.jsonl'), JSON.stringify({ viewport: viewport.name, lang, view: 'picture', scan: picture }) + '\n')
        expect(picture.empty, JSON.stringify(picture.empty)).toEqual([])
        expect(picture.unnamed, JSON.stringify(picture.unnamed)).toEqual([])
        expect(picture.overflow, JSON.stringify(picture.overflow)).toEqual([])
      })
    }
  }

  for (const viewport of VIEWPORTS) {
    if (viewport.name === '390') continue
    for (const lang of LANGS) {
      test(`corner windows ${viewport.name} ${lang}`, async ({ page }) => {
        test.setTimeout(90_000)
        await page.addInitScript((value) => localStorage.setItem('designon:lang', value), lang)
        await page.setViewportSize(viewport)
        await page.goto('/')
        const blank = page.getByRole('button', { name: /Start from a blank page|เริ่มจากหน้าว่าง|从空白页开始/ })
        if (await blank.isVisible()) await blank.click()
        await expect(blank).toBeHidden()
        await page.waitForTimeout(400)
        const widthOf = () => page.locator('.plan-canvas').evaluate((el) => (el as HTMLElement).offsetWidth)
        const before = await widthOf()
        await page.locator('.canvas-tools').getByRole('button', { name: ROOM_TOOL[lang], exact: true }).click()
        const sheet = await page.locator('.plan-canvas').boundingBox()
        if (!sheet) throw new Error('missing sheet')
        await page.mouse.move(sheet.x + sheet.width * 0.03, sheet.y + sheet.height * 0.04)
        await page.mouse.down()
        await page.mouse.move(sheet.x + sheet.width * 0.42, sheet.y + sheet.height * 0.46, { steps: 12 })
        await page.mouse.up()
        await expect(page.locator('button.room')).toHaveCount(1)
        await page.waitForTimeout(400)
        const drawn = await widthOf()
        await page.locator('.canvas-tools').getByRole('button', { name: WINDOW_TOOL[lang], exact: true }).click()
        const room = await page.locator('button.room').boundingBox()
        if (!room) throw new Error('missing room')
        const walls = [
          [room.x + room.width / 2, room.y + 4],
          [room.x + room.width - 4, room.y + room.height / 2],
          [room.x + room.width / 2, room.y + room.height - 4],
          [room.x + 4, room.y + room.height / 2],
        ]
        for (let index = 0; index < walls.length; index++) {
          const [x, y] = walls[index]
          const hit = await page.evaluate(({ x, y }) => {
            const target = document.elementFromPoint(x, y)
            const chip = target?.closest('.furniture-chip')
            return { chip: chip?.textContent?.replace(/\s+/g, ' ').trim() ?? null, tag: target?.className ?? '' }
          }, { x, y })
          expect(hit.chip, JSON.stringify(hit)).toBeNull()
          await page.mouse.click(x, y)
          await expect(page.locator('button.opening-window'), `click ${index + 1}`).toHaveCount(index + 1)
        }
        const after = await widthOf()
        expect(after, `sheet moved ${before} → ${drawn} → ${after}`).toBe(drawn)
        const strip = await page.evaluate(() => {
          const clip = (el: Element) => {
            const raw = el.getBoundingClientRect()
            let left = raw.left
            let top = raw.top
            let right = raw.right
            let bottom = raw.bottom
            let node = el.parentElement
            while (node) {
              const style = getComputedStyle(node)
              const clips = [style.overflow, style.overflowX, style.overflowY].some((value) => value === 'hidden' || value === 'clip' || value === 'auto' || value === 'scroll')
              if (clips) {
                const box = node.getBoundingClientRect()
                left = Math.max(left, box.left)
                top = Math.max(top, box.top)
                right = Math.min(right, box.right)
                bottom = Math.min(bottom, box.bottom)
              }
              node = node.parentElement
            }
            return { left, top, right, bottom }
          }
          const status = document.querySelector('.furniture-chip.is-overlay')
          const sheet = document.querySelector('.plan-canvas')
          const science = document.querySelector('.science-preview')
          const overlap = (a: Element | null, b: Element | null) => {
            if (!a || !b) return false
            const A = clip(a)
            const B = clip(b)
            return Math.min(A.right, B.right) - Math.max(A.left, B.left) > 1 && Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top) > 1
          }
          return { onSheet: overlap(status, sheet), onScience: overlap(status, science) }
        })
        expect(strip).toEqual({ onSheet: false, onScience: false })
        fs.mkdirSync(HOLD_DIR, { recursive: true })
        await page.screenshot({ path: path.join(HOLD_DIR, `hold-${viewport.name}-${lang}-corner.png`) })
      })
    }
  }

  const STAGES = [
    { step: 0, name: 'draw' },
    { step: 3, name: 'living' },
    { step: 4, name: 'systems' },
    { step: 5, name: 'cost' },
  ] as const

  for (const viewport of VIEWPORTS) {
    for (const lang of LANGS) {
      test(`sheet stays put ${viewport.name} ${lang}`, async ({ page }) => {
        test.setTimeout(180_000)
        await page.addInitScript((value) => localStorage.setItem('designon:lang', value), lang)
        await page.setViewportSize(viewport)
        await page.goto('/')
        const blank = page.getByRole('button', { name: /Start from a blank page|เริ่มจากหน้าว่าง|从空白页开始/ })
        if (await blank.isVisible()) await blank.click()
        await expect(blank).toBeHidden()
        const tool = async (name: string) => {
          const button = page.locator('.canvas-tools').getByRole('button', { name, exact: true })
          if (!(await button.isVisible())) {
            await page.getByRole('button', { name: /More tools|เครื่องมือเพิ่ม|更多工具/ }).click()
          }
          await button.click()
        }
        await tool(ROOM_TOOL[lang])
        const sheet = await page.locator('.plan-canvas').boundingBox()
        if (!sheet) throw new Error('missing sheet')
        const drag = async (ax: number, ay: number, bx: number, by: number) => {
          await page.mouse.move(sheet.x + sheet.width * ax, sheet.y + sheet.height * ay)
          await page.mouse.down()
          await page.mouse.move(sheet.x + sheet.width * bx, sheet.y + sheet.height * by, { steps: 8 })
          await page.mouse.up()
        }
        await drag(0.03, 0.05, 0.28, 0.34)
        await drag(0.40, 0.42, 0.78, 0.82)
        await expect(page.locator('button.room')).toHaveCount(2)
        const phone = viewport.name === '390'
        const rectOf = () => page.locator('.plan-canvas').evaluate((el) => {
          const box = el.getBoundingClientRect()
          return { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) }
        })
        const clearOpenings = async () => {
          if (await page.locator('button.opening').count() === 0) return
          await tool(SELECT_TOOL[lang])
          for (let guard = 0; guard < 24 && await page.locator('button.opening').count(); guard++) {
            await page.locator('button.opening').first().click({ force: true })
            await page.locator('.opening-slot .chip-action').click()
          }
          await expect(page.locator('button.opening')).toHaveCount(0)
        }
        for (const stage of STAGES) {
          await page.locator('.journey-step').nth(stage.step).click()
          await expect(page.locator('.plan-canvas')).toBeVisible()
          if (phone) {
            const close = page.getByRole('button', { name: CLOSE_PANEL[lang], exact: true })
            if (await close.isVisible()) await close.click()
          } else {
            const open = page.getByRole('button', { name: OPEN_PANEL[lang], exact: true })
            if (await open.isVisible()) await open.click()
            await expect(page.locator('.inspector')).toBeVisible()
          }
          await page.waitForTimeout(200)
          await clearOpenings()
          const before = await rectOf()
          const reserved = await page.locator('.opening-slot').evaluate((el) => {
            const chip = el.querySelector('.furniture-chip')
            return {
              display: getComputedStyle(el).display,
              h: Math.round(el.getBoundingClientRect().height),
              chipDisplay: chip ? getComputedStyle(chip).display : 'missing',
              chipVisibility: chip ? getComputedStyle(chip).visibility : 'missing',
            }
          })
          expect(reserved.display, `${stage.name} reserved slot`).not.toBe('none')
          expect(reserved.chipDisplay, `${stage.name} reserved slot`).not.toBe('none')
          expect(reserved.chipVisibility, `${stage.name} reserved slot`).toBe('hidden')
          expect(reserved.h, `${stage.name} reserved slot`).toBe(44)
          const corner = await page.locator('button.room').nth(0).boundingBox()
          const centre = await page.locator('button.room').nth(1).boundingBox()
          if (!corner || !centre) throw new Error('missing rooms')
          await tool(WINDOW_TOOL[lang])
          const cornerWalls = [
            [corner.x + corner.width / 2, corner.y + 4],
            [corner.x + corner.width - 4, corner.y + corner.height / 2],
            [corner.x + corner.width / 2, corner.y + corner.height - 4],
            [corner.x + 4, corner.y + corner.height / 2],
          ]
          for (let index = 0; index < cornerWalls.length; index++) {
            await page.mouse.click(cornerWalls[index][0], cornerWalls[index][1])
            await expect(page.locator('button.opening-window'), `${stage.name} corner ${index + 1}`).toHaveCount(index + 1)
            expect(await rectOf(), `${stage.name} corner ${index + 1}`).toEqual(before)
          }
          const centreWalls = [
            [centre.x + centre.width / 2, centre.y + 4],
            [centre.x + centre.width - 4, centre.y + centre.height / 2],
            [centre.x + centre.width / 2, centre.y + centre.height - 4],
          ]
          for (let index = 0; index < centreWalls.length; index++) {
            await page.mouse.click(centreWalls[index][0], centreWalls[index][1])
            await expect(page.locator('button.opening-window'), `${stage.name} centre window ${index + 1}`).toHaveCount(4 + index + 1)
            expect(await rectOf(), `${stage.name} centre window ${index + 1}`).toEqual(before)
          }
          await tool(DOOR_TOOL[lang])
          await page.mouse.click(centre.x + 4, centre.y + centre.height / 2)
          await expect(page.locator('button.opening-door'), `${stage.name} door`).toHaveCount(1)
          expect(await rectOf(), `${stage.name} door`).toEqual(before)
          await expect(page.locator('.opening-slot small')).toHaveText(STRIP_HINT[lang])
          const hintFit = await page.locator('.opening-slot small').evaluate((el) => {
            const range = document.createRange()
            range.selectNodeContents(el)
            const rect = range.getBoundingClientRect()
            const slot = el.closest('.opening-slot')!.getBoundingClientRect()
            const button = el.closest('.furniture-chip')?.querySelector('.chip-action')?.getBoundingClientRect()
            const overflow = Math.max(0, rect.right - slot.right, slot.left - rect.left)
            const buttonOverflow = button ? Math.max(0, button.right - slot.right, slot.left - button.left) : 99
            return {
              clipped: overflow > 2 || buttonOverflow > 2 || el.scrollWidth > el.clientWidth + 2 || (el.textContent ?? '').includes('…'),
              text: el.textContent,
              overflow: Math.round(overflow),
              buttonOverflow: Math.round(buttonOverflow),
            }
          })
          expect(hintFit.clipped, JSON.stringify(hintFit)).toBe(false)
          const row = await page.locator('.plan-control-row').evaluate((el) => {
            const box = el.getBoundingClientRect()
            const kids = [...el.children].map((kid) => kid.getBoundingClientRect())
            const zoom = el.querySelector('.zoom-control')?.getBoundingClientRect()
            const contained = (kid: DOMRect) => kid.top >= box.top - 1 && kid.bottom <= box.bottom + 1 && kid.left >= box.left - 1 && kid.right <= box.right + 1
            return {
              h: box.height,
              contained: kids.every(contained),
              zoomInside: !!zoom && contained(zoom),
            }
          })
          expect(row.h, `${stage.name} control row`).toBeLessThanOrEqual(45)
          expect(row.contained, `${stage.name} control row wraps`).toBe(true)
          expect(row.zoomInside, `${stage.name} zoom`).toBe(true)
          const slot = await page.locator('.opening-slot').evaluate((el) => {
            const chip = el.querySelector('.furniture-chip')
            return {
              display: getComputedStyle(el).display,
              h: Math.round(el.getBoundingClientRect().height),
              chipDisplay: chip ? getComputedStyle(chip).display : 'missing',
              chipVisibility: chip ? getComputedStyle(chip).visibility : 'missing',
            }
          })
          expect(slot.display, `${stage.name} slot`).not.toBe('none')
          expect(slot.chipDisplay, `${stage.name} slot`).not.toBe('none')
          expect(slot.chipVisibility, `${stage.name} slot`).toBe('visible')
          expect(slot.h, `${stage.name} slot`).toBe(44)
          if (phone) {
            const fit = await page.evaluate(() => {
              const box = (selector: string) => document.querySelector(selector)?.getBoundingClientRect() ?? null
              const rooms = box('.plan-room-key')
              const zoom = box('.zoom-control')
              const dock = box('.canvas-tools')
              const hit = rooms ? document.elementFromPoint(rooms.left + 12, rooms.top + rooms.height / 2) : null
              return {
                roomsH: rooms?.height ?? 0,
                zoomH: zoom?.height ?? 0,
                roomsAbove: !!rooms && !!dock && rooms.bottom <= dock.top + 1,
                zoomAbove: !!zoom && !!dock && zoom.bottom <= dock.top + 1,
                roomHit: !!hit?.closest('.plan-room-key'),
              }
            })
            expect(fit.roomsH, JSON.stringify(fit)).toBeGreaterThanOrEqual(44)
            expect(fit.zoomH, JSON.stringify(fit)).toBeGreaterThanOrEqual(44)
            expect(fit.roomsAbove, JSON.stringify(fit)).toBe(true)
            expect(fit.zoomAbove, JSON.stringify(fit)).toBe(true)
            expect(fit.roomHit, JSON.stringify(fit)).toBe(true)
          }
        }
        fs.mkdirSync(HOLD_DIR, { recursive: true })
        await page.screenshot({ path: path.join(HOLD_DIR, `hold-${viewport.name}-${lang}-stable.png`) })
      })
    }
  }
})

test.describe('header buttons stay apart', () => {
  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'widths are set inside this spec')
  })

  for (const width of [721, 768, 900, 1024, 1280, 1440]) {
    for (const lang of LANGS) {
      test(`${width}px ${lang} long title`, async ({ page }) => {
        await page.addInitScript((value) => localStorage.setItem('designon:lang', value), lang)
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 800 })
        await page.goto('/#plan=' + encodePlanToHash(chinaApartmentPlan))
        const welcome = page.locator('.welcome-card')
        if (await welcome.isVisible()) await welcome.getByRole('button').nth(1).click()
        await expect(page.locator('.topbar')).toBeVisible()
        const hits = await page.evaluate((title) => {
          const strong = document.querySelector('.project-picker strong') as HTMLElement | null
          const original = (strong?.textContent ?? '').trim()
          const originalTip = strong?.getAttribute('title') ?? ''
          if (strong) {
            strong.textContent = title
            strong.setAttribute('title', title)
          }
          const buttons = [...document.querySelectorAll('.topbar button, .topbar summary')].filter((button) => {
            const rect = button.getBoundingClientRect()
            const style = getComputedStyle(button)
            return rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && style.display !== 'none'
          })
          const boxes = buttons.map((button) => {
            const rect = button.getBoundingClientRect()
            const name = (button.getAttribute('aria-label') || button.textContent || '').replace(/\s+/g, ' ').trim()
            return { name, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, cx: rect.x + rect.width / 2, cy: rect.y + rect.height / 2 }
          })
          const overlaps: string[] = []
          for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
              const a = boxes[i]
              const b = boxes[j]
              const overlapX = Math.min(a.right, b.right) - Math.max(a.x, b.x)
              const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y)
              if (overlapX > 0.5 && overlapY > 0.5) overlaps.push(`${a.name} × ${b.name} ${Math.round(overlapX * overlapY)}`)
            }
          }
          const missed: string[] = []
          for (const button of buttons) {
            const rect = button.getBoundingClientRect()
            const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
            const name = (button.getAttribute('aria-label') || button.textContent || '').replace(/\s+/g, ' ').trim()
            if (!target || (target !== button && !button.contains(target))) missed.push(name)
          }
          const bar = document.querySelector('.topbar')!.getBoundingClientRect()
          const share = document.querySelector('.top-actions .top-action-label')
          const svg = share?.querySelector('svg')?.getBoundingClientRect()
          const titleStyle = strong ? getComputedStyle(strong) : null
          return {
            overlaps,
            missed,
            count: buttons.length,
            barHeight: bar.height,
            buttonSpan: boxes.length ? Math.max(...boxes.map((box) => box.bottom)) - bar.top : 0,
            flexWrap: getComputedStyle(document.querySelector('.topbar')!).flexWrap,
            planWidth: (document.querySelector('.plan-canvas') as HTMLElement | null)?.offsetWidth ?? null,
            share: svg ? { w: svg.width, h: svg.height, label: share?.getAttribute('aria-label') ?? '' } : null,
            originalTipMatches: originalTip === original && original.length > 0,
            titleTip: strong?.getAttribute('title') ?? '',
            titleNowrap: titleStyle?.whiteSpace ?? '',
            titleOverflow: titleStyle?.textOverflow ?? '',
          }
        }, 'South Light Residence · a very long project title that must leave every header button clickable')
        expect(hits.count, JSON.stringify(hits)).toBeGreaterThan(4)
        expect(hits.overlaps, JSON.stringify(hits)).toEqual([])
        expect(hits.missed, JSON.stringify(hits)).toEqual([])
        expect(hits.barHeight, JSON.stringify(hits)).toBeLessThanOrEqual(56)
        expect(hits.buttonSpan, JSON.stringify(hits)).toBeLessThanOrEqual(56)
        expect(hits.flexWrap, JSON.stringify(hits)).toBe('nowrap')
        expect(hits.share && hits.share.w > 8 && hits.share.h > 8 && hits.share.label.length > 0, JSON.stringify(hits)).toBe(true)
        expect(hits.originalTipMatches, JSON.stringify(hits)).toBe(true)
        expect(hits.titleTip, JSON.stringify(hits)).toContain('very long project title')
        expect(hits.titleNowrap, JSON.stringify(hits)).toBe('nowrap')
        expect(hits.titleOverflow, JSON.stringify(hits)).toBe('ellipsis')
        if (width === 1280) expect(hits.planWidth, JSON.stringify(hits)).toBe(618)
        if (width === 1440) expect(hits.planWidth, JSON.stringify(hits)).toBe(758)
      })
    }
  }
})

test('og-image.png renders at 1200 by 630', async ({ page }) => {
  const response = await page.request.get('/og-image.png')
  expect(response.status()).toBe(200)
  const bytes = Buffer.from(await response.body())
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(bytes.readUInt32BE(16)).toBe(1200)
  expect(bytes.readUInt32BE(20)).toBe(630)
  await page.goto('/')
  await page.evaluate(() => {
    const img = document.createElement('img')
    img.id = 'og-check'
    img.alt = 'designon preview'
    img.src = '/og-image.png'
    document.body.appendChild(img)
  })
  await expect.poll(() => page.locator('#og-check').evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1200)
  await expect.poll(() => page.locator('#og-check').evaluate((el: HTMLImageElement) => el.naturalHeight)).toBe(630)
})

const DRAW_WIDTH: Record<string, number> = { '1280': 618, '1440': 758 }

async function walkModes(page: Page, viewportName: string, lang: Lang) {
  const modes = [
    { step: 0, name: 'draw', spatial: false },
    { step: 1, name: '3d', spatial: true },
    { step: 2, name: 'sun', spatial: true },
    { step: 3, name: 'living', spatial: false },
    { step: 4, name: 'systems', spatial: false },
    { step: 5, name: 'cost', spatial: false },
  ]
  const collisions: { mode: string; pairs: string[] }[] = []
  const widths: Record<string, number | null> = {}
  let badge = { count: 0, spills: [] as string[] }
  for (const mode of modes) {
    await page.locator('.journey-step').nth(mode.step).click()
    if (mode.spatial) await expect(page.locator('.spatial3d-shell')).toBeVisible({ timeout: 25_000 })
    else await expect(page.locator('.plan-canvas')).toBeVisible()
    await page.waitForTimeout(400)
    if (mode.name === 'draw') await page.locator('button.opening').first().dispatchEvent('pointerdown')
    const report = await layoutCollisions(page)
    widths[mode.name] = report.planWidth
    if (report.collisions.length) collisions.push({ mode: mode.name, pairs: report.collisions })
    if (mode.name === '3d') {
      badge = await page.locator('.standards-badge').evaluateAll((els) => {
        const spills = els.flatMap((el) => {
          const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
          const box = el.getBoundingClientRect()
          if (box.width < 1) return []
          const wide = el.scrollWidth > el.clientWidth + 1
          const tall = el.scrollHeight > el.clientHeight + 1
          return wide || tall ? [`${text} ${el.scrollWidth}×${el.scrollHeight} in ${el.clientWidth}×${el.clientHeight}`] : []
        })
        return { count: els.length, spills }
      })
      await page.screenshot({ path: `${HOLD_DIR}/hold-${viewportName}-${lang}-overlap-3d.png` })
    }
    if (mode.name === 'draw') await page.screenshot({ path: `${HOLD_DIR}/hold-${viewportName}-${lang}-overlap-draw.png` })
    if (mode.name === 'living') await page.screenshot({ path: `${HOLD_DIR}/hold-${viewportName}-${lang}-overlap-living.png` })
  }
  await page.locator('.journey-step').nth(0).click()
  await expect(page.locator('.plan-canvas')).toBeVisible()
  await page.waitForTimeout(400)
  const restoredWidth = await page.locator('.plan-canvas').evaluate((el) => (el as HTMLElement).offsetWidth)
  const panelOnDraw = await page.locator('.inspector').count()
  const drawWidth = widths.draw
  expect(drawWidth, JSON.stringify(widths)).toBe(DRAW_WIDTH[viewportName])
  return { collisions: collisions.flatMap((item) => item.pairs.map((pair) => `${item.mode}:${pair}`)), widths, drawWidth, restoredWidth, panelOnDraw, badge }
}

async function layoutCollisions(page: Page) {
  return page.evaluate(() => {
    const shown = (selector: string) => {
      const el = document.querySelector(selector)
      if (!el) return null
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1 || style.display === 'none' || style.visibility === 'hidden') return null
      return el
    }
    const clip = (el: Element) => {
      const raw = el.getBoundingClientRect()
      let left = raw.left
      let top = raw.top
      let right = raw.right
      let bottom = raw.bottom
      let node = el.parentElement
      while (node) {
        const style = getComputedStyle(node)
        const clips = [style.overflow, style.overflowX, style.overflowY].some((value) => value === 'hidden' || value === 'clip' || value === 'auto' || value === 'scroll')
        if (clips) {
          const box = node.getBoundingClientRect()
          left = Math.max(left, box.left)
          top = Math.max(top, box.top)
          right = Math.min(right, box.right)
          bottom = Math.min(bottom, box.bottom)
        }
        node = node.parentElement
      }
      return { left, top, right, bottom }
    }
    const hits = (a: Element, b: Element) => {
      const A = clip(a)
      const B = clip(b)
      const overlapX = Math.min(A.right, B.right) - Math.max(A.left, B.left)
      const overlapY = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top)
      return overlapX > 1 && overlapY > 1
    }
    const overlays = [
      ['.inspector', 'inspector'],
      ['.furniture-chip.is-overlay', 'chip'],
      ['.science-preview', 'science'],
      ['.sun-status', 'sun'],
      ['.science-dock', 'dock'],
      ['.study-launchers', 'study'],
    ] as const
    const controls = [
      ['.ruler-arm', 'calibrate'],
      ['.value-lens-launch', 'lens'],
      ['.zoom-control', 'zoom'],
      ['.plan-room-key', 'rooms'],
      ['.spatial-toolbar', 'toolbar'],
      ['.science-seasons', 'seasons'],
      ['.outside-temperature', 'outside'],
      ['.science-method', 'method'],
      ['.spatial-sun-hud', 'hud'],
      ['.assistant-bar button.button.secondary', 'quick'],
      ['.plan-canvas', 'canvas'],
      ['.spatial3d-shell', 'shell'],
    ] as const
    const nodes = new Map<string, Element>()
    for (const [selector, name] of [...overlays, ...controls]) {
      const el = shown(selector)
      if (el) nodes.set(name, el)
    }
    const overlayNames = overlays.map(([, name]) => name).filter((name) => nodes.has(name))
    const controlNames = controls.map(([, name]) => name).filter((name) => nodes.has(name))
    const collisions: string[] = []
    const bump = (a: string, b: string) => {
      const left = nodes.get(a)!
      const right = nodes.get(b)!
      if (left === right || left.contains(right) || right.contains(left)) return
      if (hits(left, right) === false) return
      collisions.push(`${a}×${b}`)
    }
    for (const overlay of overlayNames) {
      for (const control of controlNames) bump(overlay, control)
      for (const other of overlayNames) if (other > overlay) bump(overlay, other)
    }
    const plan = document.querySelector('.plan-canvas') as HTMLElement | null
    return { collisions, planWidth: plan ? plan.offsetWidth : null }
  })
}

async function stablePlanWidth(page: Page, lang: Lang) {
  await page.waitForTimeout(400)
  const widthOf = () => page.locator('.plan-canvas').evaluate((el) => el.offsetWidth)
  const initial = await widthOf()
  await page.locator('button.opening').first().dispatchEvent('pointerdown')
  const selected = await widthOf()
  await page.keyboard.press('Escape')
  const escaped = await widthOf()
  const before = await page.locator('button.opening').count()
  await page.locator('.canvas-tools').getByRole('button', { name: WINDOW_TOOL[lang], exact: true }).click()
  const spot = await page.locator('button.opening').first().boundingBox()
  if (spot) {
    const points = [
      [spot.x + spot.width + 18, spot.y + spot.height / 2],
      [spot.x - 18, spot.y + spot.height / 2],
      [spot.x + spot.width / 2, spot.y - 18],
      [spot.x + spot.width / 2, spot.y + spot.height + 18],
    ]
    for (const [x, y] of points) {
      await page.mouse.click(x, y)
      if (await page.locator('button.opening').count() > before) break
    }
  }
  const placed = await widthOf()
  const widths = { initial, selected, escaped, placed, count: await page.locator('button.opening').count(), before }
  expect(widths.count, JSON.stringify(widths)).toBeGreaterThan(before)
  for (const width of [selected, escaped, placed]) expect(Math.abs(width - initial), JSON.stringify(widths)).toBeLessThanOrEqual(1)
  await page.keyboard.press('Escape')
  return widths
}

async function clippedByAncestor(locator: ReturnType<Page['locator']>) {
  return locator.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    let node: HTMLElement | null = el
    while (node) {
      const style = getComputedStyle(node)
      const hidden = style.overflowX === 'hidden' || style.overflowX === 'clip'
      if (hidden) {
        const box = node.getBoundingClientRect()
        if (rect.right > box.right + 1 || rect.left < box.left - 1) return true
      }
      node = node.parentElement
    }
    return el.scrollWidth > el.clientWidth + 1
  })
}

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
