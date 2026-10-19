import { expect, test } from '@playwright/test'

const STAGES = ['Draw', '3D', 'Sun', 'Living', 'Systems', 'Cost', 'Picture']
const ALLOWED = new Set(
  'designon Shanghai China Bangkok Thailand Chiang Mai Phuket Singapore Quito Ecuador Anchorage Alaska America Asia Guayaquil US SunCalc Open-Meteo GeoNames DOE WBDG DALI JSON GLB DXF STL PDF PNG SVG CAD BOQ THB RMB USD EUR ZAR SGD ECB Frankfurter ICE EPD ePM Matter KNX PM SHGC WASD Esc ERV ISO IBC ASHRAE ADA UTC CO iPhone Chrome Safari Android kWp N EN'.split(/\s+/),
)

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
})

test('welcome offers Thai, English and Chinese', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('luma-journey:welcome:shanghai-50'))
  await page.goto('/')
  const welcome = page.locator('.welcome-card')
  await expect(welcome.getByRole('button', { name: 'ไทย' })).toBeVisible()
  await expect(welcome.getByRole('button', { name: 'EN' })).toBeVisible()
  await expect(welcome.getByRole('button', { name: '中文' })).toBeVisible()
  for (const name of ['Start from a blank page', 'Explore the 50 m² sample']) {
    const box = await welcome.getByRole('button', { name }).boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
})

for (const lang of ['th', 'zh'] as const) {
  test(`${lang} chrome has no stray English and does not overflow`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('designon:lang', value), lang)
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(lang === 'zh' ? 'zh-Hans' : lang)
    const steps = page.locator('.journey-step')
    await expect(steps).toHaveCount(STAGES.length)
    for (let i = 0; i < STAGES.length; i++) {
      await steps.nth(i).click()
      await page.evaluate(() => {
        document.querySelectorAll('details').forEach((node) => {
          const details = node as HTMLDetailsElement
          if (!details.classList.contains('top-more')) details.open = true
        })
      })
      const leftover = await page.evaluate((allowed) => {
        const permit = new Set(allowed)
        const found: string[] = []
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          const parent = walker.currentNode.parentElement
          if (!parent) continue
          const style = getComputedStyle(parent)
          if (style.display === 'none' || style.visibility === 'hidden') continue
          const text = (walker.currentNode.nodeValue ?? '').trim()
          const words = text.match(/[A-Za-z][A-Za-z'’-]{2,}/g) ?? []
          const stray = words.filter((word) => !permit.has(word))
          if (stray.length) found.push(`${stray.join(',')} :: ${text.slice(0, 140)}`)
        }
        return found
      }, [...ALLOWED])
      expect(leftover, leftover.join('\n')).toEqual([])
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(1)
    }
    await page.reload()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('designon:lang'))).toBe(lang)
  })
}

test('stage controls are named and at least 44px, with four type sizes', async ({ page }) => {
  await page.goto('/')
  const steps = page.locator('.journey-step')
  for (let i = 0; i < STAGES.length; i++) {
    await steps.nth(i).click()
    const problems = await page.evaluate(() => {
      const small: string[] = []
      const unnamed: string[] = []
      const fonts = new Set<string>()
      const controls = document.querySelectorAll('button, a, input, select, summary, [role="switch"]')
      controls.forEach((node) => {
        const el = node as HTMLElement
        const style = getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') return
        const rect = el.getBoundingClientRect()
        if (rect.width < 1 || rect.height < 1) return
        const inline = el.tagName === 'A' && !!el.closest('p, .legal-note, .section-intro, .export-source, .value-lens-method')
        const labelled = el as HTMLInputElement
        const name = (
          el.getAttribute('aria-label')
          || el.getAttribute('alt')
          || el.getAttribute('title')
          || (labelled.labels && labelled.labels.length ? labelled.labels[0].textContent : '')
          || el.innerText
          || el.textContent
          || ''
        ).trim()
        if (!inline && (rect.width < 44 || rect.height < 44)) small.push(`${el.tagName} ${Math.round(rect.width)}x${Math.round(rect.height)} ${name.slice(0, 40)}`)
        if (!name) unnamed.push(`${el.tagName} ${el.className}`)
      })
      document.querySelectorAll('body *').forEach((node) => {
        const el = node as HTMLElement
        if (el.closest('svg, .study-paper, .drawing-sheet')) return
        const style = getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') return
        const rect = el.getBoundingClientRect()
        if (rect.width < 1 || rect.height < 1 || !(el.innerText || '').trim()) return
        fonts.add(style.fontSize)
      })
      return { small, unnamed, fonts: [...fonts] }
    })
    expect(problems.small, problems.small.join('\n')).toEqual([])
    expect(problems.unnamed, problems.unnamed.join('\n')).toEqual([])
    expect(problems.fonts.length).toBeLessThanOrEqual(4)
  }
})
