import { expect, test, type Page } from '@playwright/test'
import { initialPlan } from '../src/plan'
import { encodePlanToHash } from '../src/sharePlan'
import { openMore } from './workspace'

/**
 * Spatial hallucination gate (SHM).
 *
 * A layout is not allowed to invent a reason to occupy space. The tests here
 * ask the one question that catches the whole class: "why is this here, why
 * this size, and why this far from that?" — and they answer it by measuring
 * the rendered box, not by reading the CSS.
 *
 * The rules:
 *   1. A sequence shows its numbers. A tick marks a finished step; it does
 *      not replace the number, or the list reads 02…07 with 01 missing.
 *   2. A tool belongs with the tools. "Room options" is the last tool, so it
 *      follows the palette instead of being pinned to the foot of the column.
 *   3. Nothing is cut without saying so. A run of text is either whole or
 *      carries an ellipsis; "Sh" for "Shanghai" is a fragment, and it asks
 *      the reader to supply an intention the designer never had.
 *   4. What the bar drops, the menu carries — and only then.
 *   5. A control that cannot be seen is not available.
 */
const hash = encodePlanToHash(initialPlan)

async function openStudio(page: Page, width: number, height = 844) {
  await page.addInitScript(() => window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
  await page.setViewportSize({ width, height })
  await page.goto(`/#plan=${hash}`)
  await expect(page.locator('.app-shell')).toBeVisible()
}

/**
 * Every run of text in the top bar must be shown whole. An element clipped by
 * an ancestor is cut without an ellipsis unless it clips itself and says so
 * — "Sh" for "Shanghai" is a fragment, and it asks the reader to supply an
 * intention the designer never had.
 */
async function topBarFragments(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bar = document.querySelector('.app-shell .topbar')
    if (!bar) return ['the top bar is missing']
    const problems: string[] = []
    const clips = (el: Element) => {
      const style = getComputedStyle(el)
      return style.overflowX === 'hidden' || style.overflowX === 'clip'
    }
    // The right edge of an element's padding box: what a clipping ancestor
    // actually cuts at.
    const contentEdge = (el: Element) => {
      const style = getComputedStyle(el)
      return el.getBoundingClientRect().right - (parseFloat(style.borderRightWidth) || 0)
    }
    for (const el of Array.from(bar.querySelectorAll('*'))) {
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue
      const label = el.getAttribute('class')?.trim().slice(0, 40) || el.tagName
      // An element that clips its own text must say that it has.
      if (el.children.length === 0 && clips(el) && el.scrollWidth - el.clientWidth > 1) {
        if (style.textOverflow !== 'ellipsis') problems.push(`${label} is truncated with no ellipsis`)
        continue
      }
      // An element cut by an ancestor, or by the window, is a silent cut.
      let cutBy = ''
      for (let node: Element | null = el.parentElement; node; node = node.parentElement) {
        if (!clips(node)) continue
        if (rect.right > contentEdge(node) + 0.5) {
          cutBy = node.getAttribute('class')?.trim().slice(0, 30) || node.tagName
          break
        }
      }
      if (!cutBy && rect.right > window.innerWidth + 0.5) cutBy = 'the window'
      if (cutBy) problems.push(`${label} is cut by ${cutBy} with no ellipsis`)
    }
    return problems
  })
}

test.describe('spatial layout', () => {
  test.skip(({ viewport }) => viewport.width < 500, 'the width sweep runs once, in the desktop project')

  test('the journey reads 01 to 07, with or without the tick', async ({ page }) => {
    await openStudio(page, 1440)
    const steps = await page.evaluate(() => Array.from(document.querySelectorAll('.journey-step')).map(el => {
      const small = el.querySelector('small')
      return { number: (small?.textContent ?? '').trim(), ticked: !!small?.querySelector('svg') }
    }))
    expect(steps.map(step => step.number)).toEqual(['01', '02', '03', '04', '05', '06', '07'])
    // The sample plan already has a room, so stage 01 is done. A done stage
    // keeps its number and gains a tick — it never trades the number away.
    expect(steps[0].ticked, 'stage 01 is complete in the sample plan').toBe(true)
    expect(steps[0].number).toBe('01')
  })

  test('"Room options" is the last tool, not the foot of the column', async ({ page }) => {
    await openStudio(page, 1280)
    const measured = await page.evaluate(() => {
      const palette = document.querySelector('.canvas-tools .floating-island-toolbar')
      const launch = document.querySelector('.canvas-tools .room-options-launch')
      if (!palette || !launch) return null
      const tools = Array.from(palette.children).filter(el => getComputedStyle(el).display !== 'none')
      const content = tools.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0)
      return {
        gap: launch.getBoundingClientRect().top - palette.getBoundingClientRect().bottom,
        stretch: palette.getBoundingClientRect().height - content,
      }
    })
    expect(measured, 'the plan tools are on screen').not.toBeNull()
    expect(measured!.gap, 'Room options must follow the tools it belongs with').toBeLessThanOrEqual(24)
    expect(measured!.stretch, 'the palette must not stretch to fill the column').toBeLessThanOrEqual(1)
  })

  test('the top bar never cuts a run of text into a fragment', async ({ page }) => {
    await openStudio(page, 1440)
    for (const width of [1600, 1500, 1440, 1400, 1361, 1360, 1280, 1200, 1081, 1080, 1024, 1001, 1000, 900, 768]) {
      await page.setViewportSize({ width, height: 844 })
      expect(await topBarFragments(page), `the top bar must not cut text at ${width}px`).toEqual([])
    }
  })

  test('the project name is shown whole while the bar carries it', async ({ page }) => {
    await openStudio(page, 1440)
    for (const width of [1440, 1280, 1024]) {
      await page.setViewportSize({ width, height: 844 })
      const name = await page.evaluate(() => {
        const strong = document.querySelector('.app-shell .project-picker strong')
        if (!strong) return null
        if (getComputedStyle(strong).display === 'none') return null
        return { cut: strong.scrollWidth - strong.clientWidth }
      })
      expect(name, `the bar carries the name at ${width}px`).not.toBeNull()
      expect(name!.cut, `the name must be whole at ${width}px`).toBeLessThanOrEqual(1)
    }
  })

  test('the More menu carries the name exactly when the bar drops it', async ({ page }) => {
    await openStudio(page, 1440)
    const menuName = page.locator('.menu-project-name')
    const projectName = await page.evaluate(() => {
      const strong = document.querySelector('.app-shell .project-picker strong')
      return (strong?.textContent ?? '').trim()
    })
    expect(projectName, 'the bar names the project').not.toBe('')
    for (const [width, inBar] of [[1440, true], [1024, true], [1000, false], [900, false], [768, false]] as const) {
      await page.setViewportSize({ width, height: 844 })
      const shown = await page.evaluate(() => {
        const strong = document.querySelector('.app-shell .project-picker strong')
        return !!strong && getComputedStyle(strong).display !== 'none'
      })
      expect(shown, `the bar carries the name at ${width}px`).toBe(inBar)
      if (inBar) {
        // Open the menu first: a closed menu hides everything inside it, so
        // checking it while shut would pass no matter what the rule says.
        await openMore(page)
        await expect(menuName, 'the menu must not repeat what the bar already shows').toBeHidden()
        await page.getByRole('button', { name: 'More actions', exact: true }).press('Escape')
      } else {
        // Dropping the name is a decision; losing the save state with it is
        // not. The stamp stays in the bar.
        await expect(page.locator('.app-shell .project-picker small'), 'the save state stays in the bar').toBeVisible()
        await openMore(page)
        await expect(menuName, 'the menu carries the name the bar dropped').toBeVisible()
        await expect(menuName).toContainText(projectName)
        await page.getByRole('button', { name: 'More actions', exact: true }).press('Escape')
      }
    }
  })

  test('every 3D style control stays on screen', async ({ page }) => {
    await openStudio(page, 1440)
    await page.getByRole('button', { name: 'Spatial', exact: true }).click()
    await expect(page.getByRole('button', { name: '3D Orbit', exact: true })).toBeVisible()
    for (const width of [1440, 1280]) {
      await page.setViewportSize({ width, height: 844 })
      const hidden = await page.evaluate(() => {
        const toolbar = document.querySelector('.spatial-toolbar')
        if (!toolbar) return ['the 3D style row is missing']
        const box = toolbar.getBoundingClientRect()
        const off: string[] = []
        for (const button of Array.from(toolbar.querySelectorAll('.spatial-tb-btn'))) {
          const rect = button.getBoundingClientRect()
          if (rect.width === 0) continue
          if (rect.right > box.right + 1 || rect.left < box.left - 1) off.push((button.textContent ?? '').trim())
        }
        if (toolbar.scrollWidth - toolbar.clientWidth > 1) off.push('the style row scrolls behind a hidden scrollbar')
        return off
      })
      expect(hidden, `every 3D style control must be reachable at ${width}px`).toEqual([])
    }
  })
})

test.describe('spatial layout on a phone', () => {
  test.skip(({ viewport }) => viewport.width > 500, 'the phone checks run once, in the mobile project')

  test('the phone keeps the tools in one row and the name in the menu', async ({ page }) => {
    await openStudio(page, 390)
    const projectName = await page.evaluate(() => {
      const strong = document.querySelector('.app-shell .project-picker strong')
      return (strong?.textContent ?? '').trim()
    })
    expect(projectName, 'the project still has a name').not.toBe('')
    const tools = await page.evaluate(() => {
      const column = document.querySelector('.canvas-tools')
      if (!column) return null
      const button = column.querySelector('.room-options-launch')
      if (!button) return null
      const rect = button.getBoundingClientRect()
      return { right: rect.right, bottom: rect.bottom, columnWidth: column.getBoundingClientRect().width }
    })
    expect(tools, 'the phone keeps a tool row').not.toBeNull()
    expect(tools!.right, 'no tool may sit outside the phone').toBeLessThanOrEqual(390)
    const menuName = page.locator('.menu-project-name')
    await openMore(page)
    await expect(menuName, 'the phone carries the name in the menu').toBeVisible()
    await expect(menuName).toContainText(projectName)
  })
})
