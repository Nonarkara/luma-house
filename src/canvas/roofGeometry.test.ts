import { describe, expect, it } from 'vitest'
import { gableRidgeAxis } from './roofGeometry'

describe('gableRidgeAxis', () => {
  it('runs the ridge along the wider axis when the plan is wider than deep', () => {
    const { ridgeAlongX, span, ridgeLength } = gableRidgeAxis(10, 6)
    expect(ridgeAlongX).toBe(true)
    expect(ridgeLength).toBe(10)
    expect(span).toBe(6)
  })

  it('runs the ridge along the deeper axis when the plan is deeper than wide', () => {
    const { ridgeAlongX, span, ridgeLength } = gableRidgeAxis(6, 10)
    expect(ridgeAlongX).toBe(false)
    expect(ridgeLength).toBe(10)
    expect(span).toBe(6)
  })

  it('defaults to the X axis on a square footprint', () => {
    expect(gableRidgeAxis(8, 8).ridgeAlongX).toBe(true)
  })
})
