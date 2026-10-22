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
 * The drawing fits itself to the frame with an animation. A pixel measured
 * mid-animation is a fact about the animation, not about the layout, so every
 * measurement of the canvas waits for it to settle.
 */
async function settleCanvas(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
  let previous = ''
  let stable = 0
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const current = await page.evaluate(() => {
      const el = document.querySelector('.plan-canvas')
      if (!el) return ''
      const rect = el.getBoundingClientRect()
      return `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.width)},${Math.round(rect.height)}`
    })
    stable = current === previous ? stable + 1 : 0
    previous = current
    if (stable >= 4) return
    await page.waitForTimeout(120)
  }
}

/** The geometry that a transient message must not be able to move. */
async function layoutGeometry(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string) => {
      const el = document.querySelector(selector)
      if (!el) return null
      const rect = el.getBoundingClientRect()
      return [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)].join(',')
    }
    const shell = document.querySelector('.app-shell')
    return {
      rows: shell ? getComputedStyle(shell).gridTemplateRows : '',
      canvas: box('.plan-canvas'),
      viewport: box('.plan-viewport'),
      hint: box('.draw-hint'),
      chip: box('.scale-chip'),
      frame: box('.canvas-frame'),
    }
  })
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

  test('every tool says what it does', async ({ page }) => {
    // A tool that cannot explain itself makes the whole task a guess. The
    // Window and Door tools used to say nothing at all: the only way to learn
    // that a click on a wall places an opening was to click and see.
    await openStudio(page, 1440, 900)
    const said = new Map<string, string>()
    for (const tool of ['Select', 'Pencil', 'Window', 'Door']) {
      await page.getByRole('button', { name: tool, exact: true }).click()
      const hint = page.locator('.draw-hint')
      await expect(hint, `the ${tool} tool must say what it does`).toBeVisible()
      said.set(tool, (await hint.innerText()).trim())
    }
    expect(said.get('Window'), 'the Window tool must say it places a window').toMatch(/window/i)
    expect(said.get('Door'), 'the Door tool must say it places a door').toMatch(/door/i)
    expect(said.get('Select'), 'the Select tool must say it selects').toMatch(/select/i)
    expect(said.get('Pencil'), 'the pencil must keep the napkin vocabulary').toMatch(/wall/i)
    expect(new Set(said.values()).size, 'each tool must say its own thing').toBe(4)

    // The tape measure arms the canvas without changing the tool, and the
    // line used to go on saying "click a wall to place a window" — the canvas
    // was armed for measuring and the sentence was about something else.
    await page.getByRole('button', { name: 'Window', exact: true }).click()
    const windowLine = (await page.locator('.draw-hint').innerText()).trim()
    await page.getByRole('button', { name: 'Tape Measure', exact: true }).click()
    const measureLine = (await page.locator('.draw-hint').innerText()).trim()
    expect(measureLine, 'the measure must say what it measures').toMatch(/drag|measure|length/i)
    expect(measureLine, 'the line must not still be about a window').not.toBe(windowLine)
  })

  test('switching tools never moves the drawing', async ({ page }) => {
    // The instruction line is a fixed row in the drawing. It used to appear
    // and disappear with the pencil, so choosing a tool resized the frame and
    // the drawing slid under the hand.
    await openStudio(page, 1440, 900)
    await settleCanvas(page)
    const seen: string[] = []
    for (const tool of ['Select', 'Pencil', 'Window', 'Door']) {
      await page.getByRole('button', { name: tool, exact: true }).click()
      await page.waitForTimeout(150)
      seen.push(JSON.stringify(await layoutGeometry(page)))
    }
    expect(new Set(seen).size, 'the drawing must not move when the tool changes').toBe(1)
  })

  test('a status message never changes the layout', async ({ page }) => {
    // The toast used to be a static strip: a third row of the app-shell grid.
    // The drawing gave up 41px, re-fitted and moved 114px at 1440 and 396px
    // at 1024, then snapped back when the message expired.
    await openStudio(page, 1440, 900)
    await settleCanvas(page)
    const before = await layoutGeometry(page)
    expect(before.rows.split(' ').length, 'the app shell is two rows before the message').toBe(2)
    await page.locator('.top-actions').getByRole('button', { name: 'Share', exact: true }).click()
    const toast = page.locator('.toast')
    await expect(toast, 'the action is confirmed').toBeVisible()
    const during = await layoutGeometry(page)
    expect(during, 'a transient message must not move the work').toEqual(before)
    expect(during.rows.split(' ').length, 'the message must not become a row of the shell').toBe(2)
    // and it must not eat a click while it is there
    const pointerEvents = await toast.evaluate(el => getComputedStyle(el).pointerEvents)
    expect(pointerEvents, 'a transient message must never block the work').toBe('none')
  })

  test('a status message never covers a control', async ({ page }) => {
    // The toast floats in the band below the drawing. On a phone that band is
    // full — the sun card on the left, the zoom control on the right — and a
    // centred message landed on both of them: "Live sun + hea" and "65%".
    // A covered label is a cut label.
    for (const [width, height] of [[390, 844], [1024, 768], [1440, 900]] as const) {
      await openStudio(page, width, height)
      await settleCanvas(page)
      if (width <= 700) {
        await openMore(page)
        await page.getByRole('button', { name: 'Share', exact: true }).click()
      } else {
        await page.locator('.top-actions').getByRole('button', { name: 'Share', exact: true }).click()
      }
      const toast = page.locator('.toast')
      await expect(toast, `the action is confirmed at ${width}px`).toBeVisible()
      const covered = await toast.evaluate(el => {
        const rect = el.getBoundingClientRect()
        const selectors = [
          '.zoom-control', '.science-preview', '.value-lens-launch', '.scale-chip',
          '.draw-hint', '.canvas-tools', '.plan-room-key', '.topbar',
        ]
        return selectors.map((selector) => {
          const other = document.querySelector(selector)
          if (!other) return null
          const box = other.getBoundingClientRect()
          if (box.width === 0 || box.height === 0) return null
          const overlap = Math.max(0, Math.min(rect.bottom, box.bottom) - Math.max(rect.top, box.top)) *
            Math.max(0, Math.min(rect.right, box.right) - Math.max(rect.left, box.left))
          return overlap > 0 ? { selector, overlap: Math.round(overlap) } : null
        }).filter(Boolean)
      })
      expect(covered, `a transient message must not cover a control at ${width}px`).toEqual([])
    }
  })

  test('a finding is read, not squeezed into a ribbon', async ({ page }) => {
    // The finding body was 202px of JetBrains Mono in a 344px panel: 21
    // characters a line, with a 12px title over a 16px body.
    await openStudio(page, 1440, 900)
    await page.getByRole('button', { name: 'Open panel', exact: true }).click()
    const row = page.locator('.code-issue-row').first()
    await expect(row, 'the code check has findings').toBeVisible()
    const measured = await row.evaluate(el => {
      const body = el.querySelector('.code-issue-body')
      const badge = el.querySelector('.standards-badge')
      const title = el.querySelector('.code-issue-title')
      if (!body || !badge || !title) return null
      const style = getComputedStyle(body)
      const probe = document.createElement('span')
      probe.style.font = style.font
      probe.style.position = 'absolute'
      probe.style.visibility = 'hidden'
      probe.textContent = 'x'
      document.body.appendChild(probe)
      const glyph = probe.getBoundingClientRect().width
      probe.remove()
      return {
        family: style.fontFamily,
        chars: Math.round(body.getBoundingClientRect().width / glyph),
        bodyWidth: Math.round(body.getBoundingClientRect().width),
        badgeWidth: Math.round(badge.getBoundingClientRect().width),
        titleSize: parseFloat(getComputedStyle(title).fontSize),
        bodySize: parseFloat(style.fontSize),
      }
    })
    expect(measured, 'the finding has a body, a badge and a title').not.toBeNull()
    expect(measured!.family, 'a finding is prose, so it is set in the body face').toContain('Source Sans 3')
    expect(measured!.chars, 'a reading column needs a comfortable measure').toBeGreaterThanOrEqual(40)
    expect(measured!.bodyWidth, 'the finding must be wider than the badge it sits under').toBeGreaterThan(measured!.badgeWidth)
    expect(measured!.titleSize, 'the title must read before the body').toBeGreaterThan(measured!.bodySize)
  })

  test('the scale group and its action stay together', async ({ page }) => {
    // The Calibrate action was pushed to the far edge of a 1312px chip with
    // margin-left: auto, leaving 947px of nothing and a lone separator
    // stranded in it.
    await openStudio(page, 1440, 900)
    const measured = await page.evaluate(() => {
      const chip = document.querySelector('.scale-chip')
      if (!chip) return null
      const rect = (el: Element) => el.getBoundingClientRect()
      const site = chip.querySelector('.site-dim')
      const calibrate = chip.querySelector('.ruler-arm')
      if (!site || !calibrate) return null
      const separators = Array.from(chip.querySelectorAll('span')).filter(el => {
        const style = getComputedStyle(el)
        return style.display !== 'none' && (el.textContent ?? '').trim().length > 0
      })
      return {
        gapToAction: Math.round(rect(calibrate).left - rect(site).right),
        // a separator must sit between two things that are near each other
        stranded: separators
          .filter(el => {
            const previous = el.previousElementSibling
            const next = el.nextElementSibling
            if (!previous || !next) return false
            return rect(next).left - rect(previous).right > 24
          })
          .map(el => (el.textContent ?? '').trim()),
      }
    })
    expect(measured, 'the chip carries the site size and the calibration').not.toBeNull()
    expect(measured!.gapToAction, 'the action belongs with the number it acts on').toBeLessThanOrEqual(24)
    expect(measured!.stranded, 'a separator must not stand alone in a void').toEqual([])
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

  test('a status message on the phone does not move the drawing or cover the tools', async ({ page }) => {
    await openStudio(page, 390, 844)
    await settleCanvas(page)
    const before = await layoutGeometry(page)
    await openMore(page)
    await page.getByRole('button', { name: 'Share', exact: true }).click()
    const toast = page.locator('.toast')
    await expect(toast, 'the action is confirmed').toBeVisible()
    const during = await layoutGeometry(page)
    expect(during, 'a transient message must not move the work').toEqual(before)
    // the phone's tool dock is the last thing the hand reaches for
    const covers = await toast.evaluate(el => {
      const toastRect = el.getBoundingClientRect()
      const dock = document.querySelector('.canvas-tools')
      if (!dock) return 'the tool dock is missing'
      const dockRect = dock.getBoundingClientRect()
      const overlap = Math.max(0, Math.min(toastRect.bottom, dockRect.bottom) - Math.max(toastRect.top, dockRect.top))
      return Math.round(overlap)
    })
    expect(covers, 'the message must not sit on the tools').toBe(0)
  })
})
