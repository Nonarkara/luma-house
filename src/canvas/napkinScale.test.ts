import { describe, expect, it } from 'vitest'
import { calibrateSiteFromNapkinLine } from './napkinScale'

const site = { w: 14, h: 10, unit: 1 }

describe('calibrateSiteFromNapkinLine', () => {
  it('rescales the site so the drawn line matches the known length', () => {
    // Horizontal line across half the site width measures 7 m on screen.
    const { newSite, scaleRatio } = calibrateSiteFromNapkinLine(
      site,
      { p1: { x: 25, y: 50 }, p2: { x: 75, y: 50 } },
      10.5,
    )
    expect(scaleRatio).toBeCloseTo(1.5)
    expect(newSite.w).toBeCloseTo(21)
    expect(newSite.h).toBeCloseTo(15)
  })

  it('handles diagonal lines with real hypot distance', () => {
    // 3-4-5 triangle: 30% of 14m wide = 4.2m, 40% of 10m deep = 4m → 5.8m hypot
    const measured = Math.hypot(4.2, 4)
    const { scaleRatio } = calibrateSiteFromNapkinLine(
      site,
      { p1: { x: 10, y: 10 }, p2: { x: 40, y: 50 } },
      measured * 2,
    )
    expect(scaleRatio).toBeCloseTo(2)
  })

  it('ignores invalid lengths and degenerate lines', () => {
    expect(calibrateSiteFromNapkinLine(site, { p1: { x: 10, y: 10 }, p2: { x: 60, y: 10 } }, 0).scaleRatio).toBe(1)
    expect(calibrateSiteFromNapkinLine(site, { p1: { x: 10, y: 10 }, p2: { x: 60, y: 10 } }, Number.NaN).scaleRatio).toBe(1)
    expect(calibrateSiteFromNapkinLine(site, { p1: { x: 10, y: 10 }, p2: { x: 10, y: 10 } }, 5).scaleRatio).toBe(1)
  })

  it('keeps the grid unit no larger than the shrunken site', () => {
    const { newSite } = calibrateSiteFromNapkinLine(
      { w: 14, h: 10, unit: 4 },
      { p1: { x: 0, y: 50 }, p2: { x: 100, y: 50 } },
      3.5,
    )
    expect(newSite.w).toBeCloseTo(3.5)
    expect(newSite.unit).toBeLessThanOrEqual(Math.min(newSite.w, newSite.h))
  })
})
