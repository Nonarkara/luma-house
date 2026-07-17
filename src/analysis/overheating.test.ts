import { describe, expect, it } from 'vitest'
import { overheatingProfile, OVERHEAT_THRESHOLD_C } from './overheating'
import { exteriorWalls } from './walls'
import { crossVentilationScore } from './ventilation'
import type { PlanState } from '../types'

const BANGKOK_LAT = 13.7563
const ANCHORAGE_LAT = 61.2181

function profileFor(plan: PlanState, roomId: string, latitude: number) {
  const room = plan.rooms.find((r) => r.id === roomId)!
  const walls = exteriorWalls(plan).filter((w) => w.roomId === roomId)
  const vent = crossVentilationScore(plan, room)
  return overheatingProfile({
    latitude,
    plan,
    room,
    walls,
    ventilationScore: vent.score,
    insulationOn: plan.systems.insulation,
  })
}

const singleRoom = (roomId: string): PlanState => ({
  rooms: [{ id: roomId, name: 'Test room', kind: 'bedroom', x: 30, y: 30, w: 40, h: 40 }],
  openings: [],
  furniture: [],
  systems: { solar: false, insulation: false, climate: false, lighting: false },
})

describe('overheatingProfile', () => {
  it('reports zero overheating for an insulated cold-climate room', () => {
    const plan: PlanState = {
      ...singleRoom('cold'),
      systems: { solar: false, insulation: true, climate: false, lighting: false },
    }
    const result = profileFor(plan, 'cold', ANCHORAGE_LAT)
    expect(result.hoursPerYear).toBe(0)
    expect(result.worstMonth).toBe(0)
    expect(result.worstMonthLabel).toBeNull()
  })

  it('overheats a sealed Bangkok room and names a worst month', () => {
    const plan = singleRoom('hot')
    const result = profileFor(plan, 'hot', BANGKOK_LAT)
    expect(result.hoursPerYear).toBeGreaterThan(0)
    expect(result.worstMonth).toBeGreaterThanOrEqual(1)
    expect(result.worstMonth).toBeLessThanOrEqual(12)
    expect(result.worstMonthLabel).not.toBeNull()
    expect(result.thresholdC).toBe(OVERHEAT_THRESHOLD_C)
  })

  it('rewards cross-ventilation with fewer overheating hours', () => {
    const room = { id: 'r', name: 'Room', kind: 'living' as const, x: 30, y: 30, w: 40, h: 40 }
    const westOnly: PlanState = {
      rooms: [room],
      openings: [{ id: 'w-w', type: 'window', x: 30, y: 50, rotation: 90 }],
      furniture: [],
      systems: { solar: false, insulation: false, climate: false, lighting: false },
    }
    const crossVent: PlanState = {
      rooms: [room],
      openings: [
        { id: 'w-w', type: 'window', x: 30, y: 50, rotation: 90 },
        { id: 'w-e', type: 'window', x: 70, y: 50, rotation: 90 },
      ],
      furniture: [],
      systems: { solar: false, insulation: false, climate: false, lighting: false },
    }
    expect(profileFor(crossVent, 'r', BANGKOK_LAT).hoursPerYear).toBeLessThan(
      profileFor(westOnly, 'r', BANGKOK_LAT).hoursPerYear,
    )
  })

  it('rewards insulation with fewer overheating hours', () => {
    const base = singleRoom('r')
    const insulated: PlanState = { ...base, systems: { ...base.systems, insulation: true } }
    expect(profileFor(insulated, 'r', BANGKOK_LAT).hoursPerYear).toBeLessThan(
      profileFor(base, 'r', BANGKOK_LAT).hoursPerYear,
    )
  })
})
