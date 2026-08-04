import { describe, expect, it } from 'vitest'

/**
 * Pure math for the live-drag dimension readout. The component is a thin
 * renderer; the math is the part worth locking in.
 */
function liveDimMeters(rect: { x: number; y: number; w: number; h: number }, site: { w: number; h: number }) {
  const wMeters = (rect.w / 100) * site.w
  const hMeters = (rect.h / 100) * site.h
  return { wMeters, hMeters, areaM2: wMeters * hMeters }
}

describe('live dim math', () => {
  it('converts percent to meters for a 14×10 m site', () => {
    const { wMeters, hMeters, areaM2 } = liveDimMeters({ x: 0, y: 0, w: 50, h: 50 }, { w: 14, h: 10 })
    expect(wMeters).toBe(7)
    expect(hMeters).toBe(5)
    expect(areaM2).toBe(35)
  })

  it('returns 0 area for a 0-sized rect', () => {
    const { wMeters, hMeters, areaM2 } = liveDimMeters({ x: 0, y: 0, w: 0, h: 0 }, { w: 14, h: 10 })
    expect(wMeters).toBe(0)
    expect(hMeters).toBe(0)
    expect(areaM2).toBe(0)
  })

  it('handles non-default site sizes (calibrated user)', () => {
    const { wMeters, hMeters, areaM2 } = liveDimMeters({ x: 0, y: 0, w: 50, h: 50 }, { w: 21, h: 15 })
    expect(wMeters).toBe(10.5)
    expect(hMeters).toBe(7.5)
    expect(areaM2).toBe(78.75)
  })

  it('matches the existing roomArea math for a single room', () => {
    const rect = { x: 5, y: 6, w: 46, h: 43 }
    const site = { w: 14, h: 10 }
    const { areaM2 } = liveDimMeters(rect, site)
    // 46% of 14 = 6.44, 43% of 10 = 4.3 → 27.692 m²
    expect(areaM2).toBeCloseTo((46 / 100) * 14 * (43 / 100) * 10, 5)
  })
})
