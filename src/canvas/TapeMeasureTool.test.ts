import { describe, expect, it } from 'vitest'
import { calculateMeasureDistance } from './TapeMeasureTool'

describe('TapeMeasureTool', () => {
  it('calculates exact distance between two canvas points in meters and feet', () => {
    const start = { x: 10, y: 10 }
    const end = { x: 40, y: 50 } // dx = 30%, dy = 40%
    const siteWidthMeters = 20
    const siteHeightMeters = 20

    // dxM = 0.3 * 20 = 6m, dyM = 0.4 * 20 = 8m -> hypotenuse = 10m
    const line = calculateMeasureDistance(start, end, siteWidthMeters, siteHeightMeters)

    expect(line.distanceMeters).toBe(10)
    expect(line.distanceFeet).toBeCloseTo(32.81, 1)
  })
})
