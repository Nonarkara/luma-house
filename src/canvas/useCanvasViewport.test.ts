import { describe, expect, it } from 'vitest'
import { constrainViewport, contentBox, fitViewportToContent, MIN_ZOOM } from './useCanvasViewport'

describe('canvas viewport constraints', () => {
  it('treats fit-to-view as the minimum zoom', () => {
    expect(constrainViewport({ zoom: 0.5, panX: 120, panY: -80 }, 400, 300)).toEqual({
      zoom: MIN_ZOOM,
      panX: 0,
      panY: 0,
    })
  })

  it('does not allow panning when the plan is fitted', () => {
    expect(constrainViewport({ zoom: 1, panX: 70, panY: 40 }, 400, 300)).toEqual({
      zoom: 1,
      panX: 0,
      panY: 0,
    })
  })

  it('bounds panning to the enlarged viewport', () => {
    expect(constrainViewport({ zoom: 2, panX: 900, panY: -900 }, 400, 300)).toEqual({
      zoom: 2,
      panX: 200,
      panY: -150,
    })
  })

  it('zooms a small building to fill the view and centres it', () => {
    // A 40% × 40% box centred on the sheet, sheet = view = 1000 × 600.
    const fit = fitViewportToContent({ x: 30, y: 30, w: 40, h: 40 }, { width: 1000, height: 600 }, { width: 1000, height: 600 })
    expect(fit.zoom).toBeCloseTo(2.2, 2) // 0.88 / 0.4, under the 2.5 cap
    expect(fit.panX).toBeCloseTo(0, 6)
    expect(fit.panY).toBeCloseTo(0, 6)
  })

  it('pans an off-centre building back to the middle after scaling', () => {
    const fit = fitViewportToContent({ x: 50, y: 50, w: 40, h: 40 }, { width: 1000, height: 600 }, { width: 1000, height: 600 })
    // Box centre is 20% right and 20% down of sheet centre: 200 px, 120 px.
    expect(fit.panX).toBeCloseTo(-200 * fit.zoom, 6)
    expect(fit.panY).toBeCloseTo(-120 * fit.zoom, 6)
  })

  it('never zooms out below the whole sheet and resets on an empty box', () => {
    expect(fitViewportToContent({ x: 0, y: 0, w: 100, h: 100 }, { width: 800, height: 600 }, { width: 800, height: 600 }).zoom).toBe(MIN_ZOOM)
    expect(fitViewportToContent({ x: 10, y: 10, w: 0, h: 5 }, { width: 800, height: 600 }, { width: 800, height: 600 })).toEqual({ zoom: MIN_ZOOM, panX: 0, panY: 0 })
  })

  it('boxes every drawn room and returns null for an empty plan', () => {
    expect(contentBox([])).toBeNull()
    expect(contentBox([{ x: 10, y: 20, w: 30, h: 10 }, { x: 35, y: 5, w: 20, h: 40 }])).toEqual({ x: 10, y: 5, w: 45, h: 40 })
  })
})
