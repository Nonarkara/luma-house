import { describe, expect, it } from 'vitest'
import { furnitureDoorConflicts, roomOverlaps, totalArea } from '../plan'
import {
  calculateChinaApartmentBudget,
  chinaApartmentPlan,
  chinaApartmentVariants,
  chinaLightingChannels,
} from './chinaApartment'

describe('Shanghai 50 m² apartment demo', () => {
  it('keeps the authored apartment at exactly 50 m² without overlaps', () => {
    expect(totalArea(chinaApartmentPlan.rooms)).toBeCloseTo(50, 8)
    expect(roomOverlaps(chinaApartmentPlan.rooms).size).toBe(0)
    expect(furnitureDoorConflicts(chinaApartmentPlan.furniture, chinaApartmentPlan.openings).size).toBe(0)
  })

  it('keeps all lifestyle variants at the same area', () => {
    for (const variant of chinaApartmentVariants) {
      expect(totalArea(variant.rooms)).toBeCloseTo(50, 8)
      expect(roomOverlaps(variant.rooms).size).toBe(0)
    }
  })

  it('provides a detailed CNY fit-out BOQ and six lighting channels', () => {
    const budget = calculateChinaApartmentBudget(chinaApartmentPlan)
    expect(budget.currency).toBe('CNY')
    expect(budget.items).toHaveLength(13)
    expect(budget.subtotal).toBeCloseTo(430_280, 2)
    expect(budget.total).toBeCloseTo(464_702.4, 1)
    expect(chinaLightingChannels).toHaveLength(6)
    expect(chinaLightingChannels.reduce((sum, item) => sum + item.loadWatts, 0)).toBe(134)
  })

  it('puts principal glazing on the due-south apartment boundary', () => {
    const southWindows = chinaApartmentPlan.openings.filter(
      (opening) => opening.type === 'window' && opening.rotation === 0 && opening.y > 78,
    )
    expect(southWindows).toHaveLength(3)
  })
})
