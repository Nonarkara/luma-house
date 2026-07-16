import { describe, expect, it } from 'vitest'
import { calculateBudget, estimateEnergySavings, furnitureDoorConflicts, furnitureRect, initialPlan, roomArea, solarPosition, totalArea } from './plan'
import type { Opening } from './types'

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

  it('renders furniture at its real-world footprint', () => {
    const rect = furnitureRect({ id: 'f', kind: 'bed', x: 10, y: 10, rotated: false })
    expect(rect.w).toBeCloseTo((2.0 / 14) * 100)
    expect(rect.h).toBeCloseTo((1.8 / 10) * 100)
    const rotated = furnitureRect({ id: 'f', kind: 'bed', x: 10, y: 10, rotated: true })
    expect(rotated.w).toBeCloseTo((1.8 / 14) * 100)
  })

  it('flags furniture inside a door swing and clears distant furniture', () => {
    const door: Opening = { id: 'd', type: 'door', x: 50, y: 50, rotation: 0 }
    const window: Opening = { id: 'w', type: 'window', x: 6, y: 6, rotation: 0 }
    const conflicts = furnitureDoorConflicts(
      [
        { id: 'near', kind: 'bed', x: 50, y: 51, rotated: false },
        { id: 'far', kind: 'bed', x: 5, y: 5, rotated: false },
      ],
      [door, window],
    )
    expect(conflicts.has('near')).toBe(true)
    expect(conflicts.has('far')).toBe(false)
  })
})
