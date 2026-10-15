import { describe, expect, it } from 'vitest'
import { furnitureDoorConflicts, furnitureRectFor, roomOverlaps, siteOf, totalArea } from '../plan'
import { roomOptionIssues } from '../options/roomOptions'
import { calculateChinaApartmentBudget, chinaApartmentPlan, chinaApartmentVariants, chinaLightingChannels } from './chinaApartment'

describe('Shanghai sample', () => {
  // The first drawing a layperson opens must not already fail its own fit checks.
  it.each(chinaApartmentPlan.rooms.map(r => [r.name, r] as const))('%s has no furniture fit issues', (_name, room) => {
    expect(roomOptionIssues(chinaApartmentPlan, room, chinaApartmentPlan.furniture)).toEqual([])
  })
})


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
    expect(budget.items).toHaveLength(15)
    expect(budget.subtotal).toBeCloseTo(459_280, 2)
    expect(budget.total).toBeCloseTo(496_022.4, 1)
    expect(chinaLightingChannels).toHaveLength(6)
    expect(chinaLightingChannels.reduce((sum, item) => sum + item.loadWatts, 0)).toBe(134)
  })

  it('scales the allowance from the drawing and selected systems', () => {
    const blank = calculateChinaApartmentBudget({ ...chinaApartmentPlan, rooms: [], openings: [], furniture: [] })
    expect(blank.total).toBe(0)
    const withoutEnvelope = calculateChinaApartmentBudget({ ...chinaApartmentPlan, systems: { ...chinaApartmentPlan.systems, insulation: false } })
    expect(withoutEnvelope.total).toBeLessThan(calculateChinaApartmentBudget(chinaApartmentPlan).total)
  })

  it('puts principal glazing on the due-south apartment boundary', () => {
    const southWindows = chinaApartmentPlan.openings.filter(
      (opening) => opening.type === 'window' && opening.rotation === 0 && opening.y > 78,
    )
    expect(southWindows).toHaveLength(3)
  })
})


describe('every sample piece belongs to a room', () => {
  it.each(chinaApartmentVariants.map(p => [p.name, { ...chinaApartmentPlan, rooms: p.rooms }] as const))('%s has no orphaned or crossing furniture', (_id, variant) => {
    for (const piece of variant.furniture) {
      const box = furnitureRectFor(piece, siteOf(variant))
      const rooms = variant.rooms.filter(r => box.x >= r.x - 1e-6 && box.y >= r.y - 1e-6 && box.x + box.w <= r.x + r.w + 1e-6 && box.y + box.h <= r.y + r.h + 1e-6)
      expect(rooms, piece.id).toHaveLength(1)
    }
  })
})
