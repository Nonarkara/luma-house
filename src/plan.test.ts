import { describe, expect, it } from 'vitest'
import { calculateBudget, estimateEnergySavings, initialPlan, roomArea, solarPosition, totalArea } from './plan'

describe('plan calculations', () => {
  it('converts percentage room dimensions into square meters', () => {
    expect(roomArea({ id: 'a', name: 'Room', kind: 'living', x: 0, y: 0, w: 50, h: 50 })).toBe(35)
  })

  it('totals rooms and creates a positive construction estimate', () => {
    const area = totalArea(initialPlan.rooms)
    const budget = calculateBudget(initialPlan)
    expect(area).toBeCloseTo(96.572)
    expect(budget.total).toBeGreaterThan(budget.subtotal)
  })

  it('places the Bangkok sun above the horizon at noon', () => {
    const sun = solarPosition(13.7563, 196, 12)
    expect(sun.altitude).toBeGreaterThan(60)
  })

  it('rewards selected intelligent systems without exceeding the cap', () => {
    expect(estimateEnergySavings({ solar: true, insulation: true, climate: true, lighting: true })).toBe(64)
  })
})
