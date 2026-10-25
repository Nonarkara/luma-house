import { describe, expect, it } from 'vitest'
import { chinaApartmentPlan, isAuthoredChinaApartment } from './chinaApartment'

describe('authored Shanghai sample identity', () => {
  it('accepts the intact authored plan and room-name variants', () => {
    expect(isAuthoredChinaApartment(chinaApartmentPlan)).toBe(true)
    expect(isAuthoredChinaApartment({
      ...chinaApartmentPlan,
      rooms: chinaApartmentPlan.rooms.map(room => room.id === 'study' ? { ...room, name: 'Acoustic study' } : room),
    })).toBe(true)
  })

  it('rejects drawings that only reuse a sample room id', () => {
    expect(isAuthoredChinaApartment({
      rooms: [{ ...chinaApartmentPlan.rooms[0] }],
      openings: [],
      furniture: [],
      systems: { solar: false, insulation: false, climate: false, lighting: false },
    })).toBe(false)
  })

  it.each([
    ['opening', { ...chinaApartmentPlan, openings: chinaApartmentPlan.openings.slice(1) }],
    ['furniture', { ...chinaApartmentPlan, furniture: chinaApartmentPlan.furniture.slice(1) }],
    ['system', { ...chinaApartmentPlan, systems: { ...chinaApartmentPlan.systems, climate: false } }],
  ])('rejects a modified %s schedule', (_name, plan) => {
    expect(isAuthoredChinaApartment(plan)).toBe(false)
  })
})
