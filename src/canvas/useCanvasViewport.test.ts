import { describe, expect, it } from 'vitest'
import { constrainViewport, MIN_ZOOM } from './useCanvasViewport'

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
})
