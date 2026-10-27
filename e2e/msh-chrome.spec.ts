import { expect, test, type Page } from '@playwright/test'
import { chinaApartmentPlan } from '../src/mockups/chinaApartment'
import { encodePlanToHash } from '../src/sharePlan'

/**
 * The chrome of the 3D view, measured.
 *
 * The bottom of the Spatial view used to be five bands — the furniture bar,
 * the study row, the five numbers, the time row and the assistant — under a
 * 557px model. On a phone the 3D toolbar was a desktop row allowed to wrap,
 * so it became five rows of buttons above a 270px model, and the tool dock
 * beside it was a 390px band holding 89px of undo and redo.
 *
 * These gates own the numbers that came out of that, so a later change cannot
 * quietly take the space back. They measure the rendered page; they do not
 * read the stylesheet.
 */

const namedHash = encodePlanToHash(chinaApartmentPlan)

async function openStudio(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('luma-journey:welcome:shanghai-50', '1'))
  await page.goto(`/#plan=${namedHash}`)
  await expect(page.locator('.app-shell')).toBeVisible()
}

async function openSpatial(page: Page) {
  await page.getByRole('button', { name: 'Spatial', exact: true }).click({ noWaitAfter: true })
  await expect(page.locator('.spatial3d-shell')).toBeVisible({ timeout: 60_000 })
  await page.waitForTimeout(2500)
}

interface Chrome {
  viewH: number
  modelH: number
  topChrome: number
  bottomChrome: number
  bandCount: number
  surfaces: number
  overlapModel: number
  widest: number
  viewW: number
}

/** The chrome of the rendered Spatial view, measured from the DOM. */
async function measure(page: Page): Promise<Chrome> {
  return page.evaluate(() => {
    const round = (n: number) => Math.round(n * 100) / 100
    const viewH = window.innerHeight
    const viewW = window.innerWidth
    const model = document.querySelector('.spatial-model')
    const modelBox = model!.getBoundingClientRect()

    // The rows inside the surface that holds the 3D view's chrome.
    const bottom = document.querySelector('.spatial-bottom')
    const bands = bottom ? Array.from(bottom.children).filter(el => el.getBoundingClientRect().height > 0) : []
    const bottomChrome = viewH - modelBox.bottom

    // The surfaces themselves: everything the 3D view draws that is neither
    // the toolbar nor the model. A surface that is split becomes two of
    // these, and the bottom is a stack of bands again. The count is by
    // identity, not by position, because a split surface does not stay
    // politely below the model - it floats up over it.
    const shell = document.querySelector('.spatial3d-shell')!
    const modelEl = document.querySelector('.spatial-model')!
    const toolbarEl = document.querySelector('.spatial-toolbar')
    const surfaces = Array.from(shell.children).filter(el =>
      el !== modelEl && el !== toolbarEl && el.getBoundingClientRect().height > 0)
    const overlapModel = surfaces.filter(el => {
      const rect = el.getBoundingClientRect()
      return rect.top < modelBox.bottom - 1 && rect.bottom > modelBox.top + 1
    }).length

    // The widest element that should not be: nothing in the app may be wider
    // than the window it is drawn in.
    let widest = 0
    for (const el of Array.from(document.querySelectorAll('.spatial3d-shell *'))) {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0) widest = Math.max(widest, rect.width)
    }

    return {
      viewH,
      viewW,
      modelH: round(modelBox.height),
      topChrome: round(modelBox.top),
      bottomChrome: round(bottomChrome),
      bandCount: bands.length,
      surfaces: surfaces.length,
      overlapModel,
      widest: round(widest),
    }
  })
}

test.describe('the chrome of the 3D view', () => {
  // Switching views builds a 3D scene, which can block the page past the
  // default action budget on a loaded machine: the click itself succeeds and
  // then the wait for the page to settle runs out of time.
  test.use({ actionTimeout: 30_000 })

  test('the bottom of the model is one surface, not a stack of bands', async ({ page }) => {
    await openStudio(page)
    await openSpatial(page)
    const chrome = await measure(page)
    // One surface under the model. This is the shape the defect had: the
    // bottom used to be five separate bands, each with its own rule, and a
    // surface that is split is that defect again.
    expect(chrome.surfaces, 'the 3D view draws one surface under the model').toBeLessThanOrEqual(1)
    // The surface carries the selection, the state, the numbers and the
    // time: two rows at most, never four.
    expect(chrome.bandCount, 'the 3D footer is one surface with rows inside it').toBeLessThanOrEqual(2)
    // And nothing in that chrome is allowed to float up over the model.
    expect(chrome.overlapModel, 'the chrome below the model does not cover it').toBe(0)
  })

  test('the model keeps the room, and the chrome under it stays a third', async ({ page }) => {
    for (const [width, height] of [[1440, 900], [1024, 800], [390, 844]] as const) {
      await page.setViewportSize({ width, height })
      await openStudio(page)
      await openSpatial(page)
      const chrome = await measure(page)
      const frame = chrome.topChrome + chrome.bottomChrome
      // The model is the work, and the work outweighs its frame. On a phone
      // the chrome was 526px against a 270px model before this change.
      expect(chrome.modelH, `the 3D model must outweigh the chrome around it at ${width}px`).toBeGreaterThan(frame)
      expect(chrome.bottomChrome / chrome.viewH, `the footer must stay under a third at ${width}px`).toBeLessThan(0.35)
    }
  })

  test('nothing in the 3D view is wider than the window', async ({ page }) => {
    // A toolbar row that is wider than the screen pushed the canvas out to
    // 1199px inside a 390px viewport, and the model was drawn off the page.
    await page.setViewportSize({ width: 390, height: 844 })
    await openStudio(page)
    await openSpatial(page)
    const chrome = await measure(page)
    expect(chrome.widest, 'no element may be wider than the window it is drawn in').toBeLessThanOrEqual(chrome.viewW + 1)
  })

  test('phone and tablet keep the 3D controls in one row', async ({ page }) => {
    for (const width of [390, 1024]) {
    await page.setViewportSize({ width, height: 844 })
    await openStudio(page)
    await openSpatial(page)
    const rows = await page.evaluate(() => {
      const toolbar = document.querySelector('.spatial-toolbar')!
      const top = toolbar.getBoundingClientRect().top
      const rows = new Set<number>()
      for (const el of Array.from(toolbar.querySelectorAll('.spatial-tb-btn'))) {
        const rect = el.getBoundingClientRect()
        if (rect.width > 0) rows.add(Math.round(rect.top - top))
      }
      return rows.size
    })
    expect(rows, 'the 3D toolbar is one row on a phone, and it says that it scrolls').toBe(1)
    }
  })

  test('empty-room guidance is operable below the model in both views', async ({ page }) => {
    const empty = { ...chinaApartmentPlan, rooms: [], furniture: [], openings: [] }
    await page.goto('/#plan=' + encodePlanToHash(empty))
    for (const view of ['Spatial', 'Renders']) {
      await page.getByRole('button', { name: view, exact: true }).click()
      const note = page.locator('.spatial-bottom > .spatial-ghost-note')
      await expect(note).toContainText('Draw a room in Plan')
      const model = (await page.locator('.spatial-model').boundingBox())!
      expect((await note.boundingBox())!.y).toBeGreaterThanOrEqual(model.y + model.height - 1)
      const action = page.getByRole('button', { name: 'Go to Plan', exact: true })
      await action.scrollIntoViewIfNeeded()
      expect(await action.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) })).toBe(true)
    }
    await page.getByRole('button', { name: 'Go to Plan', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveClass(/active/)
  })

  test('the phone does not keep an empty tool dock', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openStudio(page)
    await openSpatial(page)
    const dock = await page.evaluate(() => {
      const el = document.querySelector('.canvas-tools')!
      const rect = el.getBoundingClientRect()
      const inner = Array.from(el.querySelectorAll('.dock-history .icon-button')).reduce((sum, b) => sum + b.getBoundingClientRect().width, 0)
      return { width: Math.round(rect.width), inner: Math.round(inner) }
    })
    // The 3D view has no plan toolbar, so the dock is only the undo and redo.
    expect(dock.width, 'the dock is only as wide as what it carries').toBeLessThanOrEqual(dock.inner + 8)
  })

  test('non-plan views return the unused desktop palette track to the model', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await openStudio(page)
    for (const view of ['Spatial', 'Renders']) {
      await page.getByRole('button', { name: view, exact: true }).click()
      const rail = (await page.locator('.journey-rail-wrap').boundingBox())!
      const frame = (await page.locator('.canvas-frame').boundingBox())!
      expect(frame.x, 'there is no empty palette column between the journey and drawing').toBeLessThanOrEqual(rail.x + rail.width + 1)
      await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeVisible()
    }
  })

  test('the snapshot leads with the two figures that answer the question', async ({ page }) => {
    await openStudio(page)
    await openSpatial(page)
    const dock = await page.evaluate(() => {
      const primary = document.querySelector('.science-metric.is-primary')!
      const net = document.querySelector('.science-net')!
      const breakdown = document.querySelector('.science-breakdown')!
      const size = (el: Element) => parseFloat(getComputedStyle(el).fontSize)
      return {
        primary: size(primary.querySelector('strong')!),
        net: size(net.querySelector('strong')!),
        breakdown: size(breakdown.querySelector('strong')!),
      }
    })
    expect(dock.primary, 'the primary figure is the body role').toBeGreaterThan(dock.breakdown)
    expect(dock.net, 'the net figure is the body role').toBeGreaterThan(dock.breakdown)
  })

  test('the phone shows the sunlit floor, not only the net', async ({ page }) => {
    // The phone used to pick the figure to show by position in the row, so a
    // change to the markup hid the sunlit floor without anyone noticing.
    await page.setViewportSize({ width: 390, height: 844 })
    await openStudio(page)
    await openSpatial(page)
    await expect(page.locator('.science-metric.is-primary')).toBeVisible()
    await expect(page.locator('.science-metric.is-primary')).toContainText('Sunlit floor now')
  })

  test('the sun controls sit under the model, not over it', async ({ page }) => {
    // The studio's own rule: controls live outside the drawing viewport. The
    // sun controls were a sibling of the 3D content; they are part of the
    // bottom surface now, and they still must not touch the model.
    await openStudio(page)
    await openSpatial(page)
    const boxes = await page.evaluate(() => {
      const model = document.querySelector('.spatial-model')!.getBoundingClientRect()
      const dock = document.querySelector('.spatial-bottom > .science-dock')!.getBoundingClientRect()
      return { modelBottom: model.bottom, dockTop: dock.top }
    })
    expect(boxes.dockTop, 'the sun controls sit below the model').toBeGreaterThanOrEqual(boxes.modelBottom - 1)
  })

  test('the study launchers sit under the model, not over it', async ({ page }) => {
    await openStudio(page)
    await openSpatial(page)
    const boxes = await page.evaluate(() => {
      const model = document.querySelector('.spatial-model')!.getBoundingClientRect()
      const launchers = document.querySelector('.study-launchers')!.getBoundingClientRect()
      return { modelBottom: model.bottom, launchersTop: launchers.top }
    })
    expect(boxes.launchersTop, 'the study launchers sit below the model').toBeGreaterThanOrEqual(boxes.modelBottom - 1)
  })

  test('nothing floats over the study launchers', async ({ page }) => {
    // The gallery's floating page control landed on the launchers: the
    // buttons were drawn and could not be clicked. A control that overlaps
    // another control is a defect, so the topmost element at the button has
    // to be the button.
    for (const view of ['Spatial', 'Renders']) {
      await openStudio(page)
      if (view === 'Spatial') {
        await openSpatial(page)
      } else {
        await page.getByRole('button', { name: 'Renders', exact: true }).click({ noWaitAfter: true })
        await expect(page.locator('.spatial3d-shell')).toBeVisible({ timeout: 60_000 })
        await page.waitForTimeout(2500)
      }
      const covered = await page.evaluate(() => {
        const out: Array<{ label: string; covered: boolean }> = []
        for (const button of Array.from(document.querySelectorAll('.study-launchers button'))) {
          button.scrollIntoView({ block: 'nearest' })
          const rect = button.getBoundingClientRect()
          if (rect.width < 1 || rect.height < 1) continue
          const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          out.push({
            label: (button.textContent ?? '').trim(),
            covered: !(top === button || button.contains(top)),
          })
        }
        return out
      })
      expect(covered.length, `the study launchers are present in ${view}`).toBeGreaterThan(0)
      for (const button of covered) {
        expect(button.covered, `the "${button.label}" launcher is not covered in ${view}`).toBe(false)
      }
      if (view === 'Renders') {
        const stage = (await page.locator('.render-stage').boundingBox())!
        const nav = (await page.locator('.render-navigation').boundingBox())!
        expect(nav.y, 'gallery navigation stays below the preview').toBeGreaterThanOrEqual(stage.y + stage.height - 1)
        await page.getByRole('button', { name: 'Next view', exact: true }).click()
        await expect(page.locator('.render-meta')).toContainText('Live 3D massing')
        await page.getByRole('button', { name: 'Previous view', exact: true }).click()
        await expect(page.locator('.spatial3d-shell')).toBeVisible()
      }
    }
  })
})
