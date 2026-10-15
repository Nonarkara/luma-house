import { describe, expect, it } from 'vitest'
import { roomOptionIssues } from '../options/roomOptions'
import { chinaApartmentPlan } from './chinaApartment'

describe('Shanghai sample', () => {
  // The first drawing a layperson opens must not already fail its own fit checks.
  it.each(chinaApartmentPlan.rooms.map(r => [r.name, r] as const))('%s has no furniture fit issues', (_name, room) => {
    expect(roomOptionIssues(chinaApartmentPlan, room, chinaApartmentPlan.furniture)).toEqual([])
  })
})
