import { expect, test, type Page } from '@playwright/test'
import { initialPlan } from '../src/plan'
import { chinaApartmentPlan } from '../src/mockups/chinaApartment'
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
 *
 * And three that hold the bar's shape together: its three parts never
 * overlap; the mode switch sits the same distance from the identity and from
 * the actions; and the identity gives ground by decision — a thing is
 * dropped — never by pressure, which is a thing being cut.
 */
const hash = encodePlanToHash(initialPlan)
/* The bar's geometry has to survive the project's real name, not a short
   placeholder: "South Light 50 · 向阳之家" is 174px of it, and that is the
   width the drop bands were measured against. A gate that measures the bar
   while it carries "Untitled sketch" cannot see a squeezed identity, because
   a short name never fills the space. */
const namedHash = encodePlanToHash(chinaApartmentPlan)

async function openStudio(page: Page, width: number, height = 844, planHash = namedHash) {
  await page.addInitScript(() => window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
  await page.setViewportSize({ width, height })
  await page.goto(`/#plan=${planHash}`)
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
    await openStudio(page, 1440, 844, hash)
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
    // Every band edge, on both sides, because that is where a cut happens.
    for (const width of [1600, 1500, 1440, 1400, 1300, 1225, 1224, 1200, 1150, 1149, 1100, 1025, 1024, 1000, 920, 919, 900, 820, 819, 800, 768, 721, 720, 390]) {
      await page.setViewportSize({ width, height: 844 })
      expect(await topBarFragments(page), `the top bar must not cut text at ${width}px`).toEqual([])
    }
  })

  test('the bar is three parts: what it is, which view, what you can do', async ({ page }) => {
    await openStudio(page, 1440)
    for (const width of [1440, 1280]) {
      await page.setViewportSize({ width, height: 844 })
      const measured = await page.evaluate(() => {
        const centre = document.querySelector('.app-shell .topbar-center')
        const actions = document.querySelector('.app-shell .top-actions')
        const identity = document.querySelector('.app-shell .topbar-left')
        const history = actions?.querySelector('.history-tools')
        const more = actions?.querySelector('.top-more')
        if (!centre || !actions || !identity || !history || !more) return null
        const r = (el: Element) => el.getBoundingClientRect()
        return {
          centreChildren: Array.from(centre.children).filter(el => getComputedStyle(el).display !== 'none').length,
          historyInActions: actions.contains(history),
          // the gap between the last action of one kind and the first of the next
          splitGap: Math.round(r(more).left - r(history).right),
          // the quiet space that separates the centred view switch from the actions
          modeGap: Math.round(r(actions).left - r(centre).right),
          // and the space on the other side of the mode switch
          identityGap: Math.round(r(centre).left - r(identity).right),
        }
      })
      expect(measured, 'the bar has all three parts').not.toBeNull()
      expect(measured!.centreChildren, 'the centre holds the view switch alone').toBe(1)
      expect(measured!.historyInActions, 'undo and redo sit with the other actions').toBe(true)
      expect(measured!.splitGap, 'the actions are one group, not two halves of a bar apart').toBeLessThanOrEqual(12)
      expect(measured!.modeGap, 'the mode switch is separated from the actions, not merged with them').toBeGreaterThan(24)
      // The mode switch is the hinge between the two flanks, so it sits the
      // same distance from each. Equal flanks were the old grid's claim, and
      // the grid took the room from the wrong side.
      expect(
        Math.abs(measured!.modeGap - measured!.identityGap),
        'the mode switch is equidistant from the identity and the actions',
      ).toBeLessThanOrEqual(1)
    }
  })

  test('the three parts of the bar never overlap', async ({ page }) => {
    await openStudio(page, 1440)
    for (const width of [1600, 1440, 1300, 1225, 1224, 1150, 1149, 1025, 1024, 920, 919, 820, 819, 768, 721, 720, 390]) {
      await page.setViewportSize({ width, height: 844 })
      const measured = await page.evaluate(() => {
        const box = (selector: string) => {
          const el = document.querySelector(selector)
          if (!el || getComputedStyle(el).display === 'none') return null
          const rect = el.getBoundingClientRect()
          return { left: rect.left, right: rect.right }
        }
        const identity = box('.app-shell .topbar-left')
        const centre = box('.app-shell .topbar-center')
        const actions = box('.app-shell .top-actions')
        if (!identity || !centre || !actions) return null
        return {
          identityRight: identity.right,
          centreLeft: centre.left,
          centreRight: centre.right,
          actionsLeft: actions.left,
          actionsRight: actions.right,
          windowRight: window.innerWidth,
        }
      })
      expect(measured, `the bar has three parts at ${width}px`).not.toBeNull()
      expect(measured!.identityRight, `the identity must not run into the mode switch at ${width}px`)
        .toBeLessThanOrEqual(measured!.centreLeft + 0.5)
      expect(measured!.centreRight, `the mode switch must not run into the actions at ${width}px`)
        .toBeLessThanOrEqual(measured!.actionsLeft + 0.5)
      expect(measured!.actionsRight, `the actions must stay inside the window at ${width}px`)
        .toBeLessThanOrEqual(measured!.windowRight + 0.5)
    }
  })

  test('the identity gives ground by decision, never by pressure', async ({ page }) => {
    // The bar has two ways to lose the identity: drop a thing on purpose, or
    // let the row squeeze it. Dropping is fine — the thing has a way back. Being
    // squeezed is not: the name is cut, the city is amputated, and the reader
    // is left with a fragment and no explanation.
    //
    // So the identity's box must never be narrower than the content inside
    // it, and the name must never be cut while the bar still carries it. A
    // band placed too late fails here.
    await openStudio(page, 1440)
    // Measure after the fonts have settled: a webfont swap changes the width
    // of a text run, and a pixel measured before the swap is not a fact.
    await page.evaluate(() => document.fonts.ready)
    const widths = [1600, 1440, 1300, 1225, 1224, 1200, 1150, 1149, 1100, 1025, 1024, 1000, 950, 920, 919, 900, 860, 820, 819, 780, 740, 721, 720, 390]
    let carried = 0b11111
    for (const width of widths) {
      await page.setViewportSize({ width, height: 844 })
      const measured = await page.evaluate(() => {
        const identity = document.querySelector('.app-shell .topbar-left')
        if (!identity) return null
        const visible = (selector: string) => {
          const el = document.querySelector(selector)
          if (!el) return false
          if (getComputedStyle(el).display === 'none') return false
          return typeof el.checkVisibility === 'function' ? el.checkVisibility() : true
        }
        const strong = document.querySelector('.app-shell .project-picker strong')
        const nameCut = strong && getComputedStyle(strong).display !== 'none' && strong.checkVisibility()
          ? strong.scrollWidth - strong.clientWidth
          : 0
        // A bit per thing the identity can carry. The ladder is one-way: a
        // bit that has gone never comes back.
        const mask = (visible('.topbar-meta .stage-area') ? 1 : 0)
          | (visible('.app-shell .topbar-left .brand-wordmark') ? 2 : 0)
          | (visible('.topbar-meta .location-toggle') ? 4 : 0)
          | (visible('.app-shell .project-picker strong') ? 8 : 0)
          | (visible('.app-shell .project-picker small') ? 16 : 0)
        return { mask, nameCut }
      })
      expect(measured, `the bar has an identity at ${width}px`).not.toBeNull()
      expect(measured!.nameCut, `the name must be whole at ${width}px`).toBeLessThanOrEqual(1)
      expect(
        measured!.mask & ~carried,
        `the identity must not grow at ${width}px — a dropped thing came back`,
      ).toBe(0)
      carried = measured!.mask
    }
    // and the ladder is really a ladder
    expect(carried, 'by the phone the identity is only its mark').toBe(0)
  })

  test('the project name is shown whole while the bar carries it', async ({ page }) => {
    await openStudio(page, 1440)
    for (const width of [1440, 1280, 1024]) {
      await page.setViewportSize({ width, height: 844 })
      const name = await page.evaluate(() => {
        const strong = document.querySelector('.app-shell .project-picker strong')
        if (!strong) return null
        if (getComputedStyle(strong).display === 'none' || !strong.checkVisibility()) return null
        return { cut: strong.scrollWidth - strong.clientWidth }
      })
      expect(name, `the bar carries the name at ${width}px`).not.toBeNull()
      expect(name!.cut, `the name must be whole at ${width}px`).toBeLessThanOrEqual(1)
    }
  })

  test('the More menu carries the name and the save state exactly when the bar drops them', async ({ page }) => {
    await openStudio(page, 1440)
    const menuName = page.locator('.menu-project-name')
    const menuStamp = page.locator('.menu-project-stamp')
    const projectName = await page.evaluate(() => {
      const strong = document.querySelector('.app-shell .project-picker strong')
      return (strong?.textContent ?? '').trim()
    })
    expect(projectName, 'the bar names the project').not.toBe('')
    // [width, the name is in the bar, the save state is in the bar]
    const ladder = [
      [1440, true, true], [1024, true, true], [921, true, true], [820, true, true],
      [819, false, true], [768, false, true], [720, false, false], [390, false, false],
    ] as const
    for (const [width, nameInBar, stampInBar] of ladder) {
      await page.setViewportSize({ width, height: 844 })
      const shown = await page.evaluate(() => {
        const visible = (selector: string) => {
          const el = document.querySelector(selector)
          if (!el) return false
          if (getComputedStyle(el).display === 'none') return false
          return typeof el.checkVisibility === 'function' ? el.checkVisibility() : true
        }
        return {
          name: visible('.app-shell .project-picker strong'),
          stamp: visible('.app-shell .project-picker small'),
        }
      })
      expect(shown.name, `the bar carries the name at ${width}px`).toBe(nameInBar)
      expect(shown.stamp, `the bar carries the save state at ${width}px`).toBe(stampInBar)
      // Open the menu first: a closed menu hides everything inside it, so
      // checking it while shut would pass no matter what the rule says.
      await openMore(page)
      if (nameInBar) {
        await expect(menuName, 'the menu must not repeat what the bar already shows').toBeHidden()
      } else {
        // The bar cannot hold the name, so the menu carries it. Dropping a
        // name is a decision; losing the reader's reassurance is not.
        await expect(menuName, 'the menu carries the name the bar dropped').toBeVisible()
        await expect(menuName).toContainText(projectName)
      }
      if (stampInBar) {
        await expect(menuStamp, 'the menu must not repeat the save state the bar still shows').toBeHidden()
      } else {
        await expect(menuStamp, 'the menu carries the save state the bar dropped').toBeVisible()
        await expect(menuStamp).toContainText('Saved locally')
      }
      await page.getByRole('button', { name: 'More actions', exact: true }).press('Escape')
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
    const menuStamp = page.locator('.menu-project-stamp')
    await openMore(page)
    await expect(menuName, 'the phone carries the name in the menu').toBeVisible()
    await expect(menuName).toContainText(projectName)
    await expect(menuStamp, 'the phone carries the save state in the menu').toBeVisible()
    await expect(menuStamp).toContainText('Saved locally')
  })
})
