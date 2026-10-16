import { describe, expect, it } from 'vitest'
import { applyRoomOption, generateRoomOptions, measureRoom, roomOptionIssues } from './roomOptions'
import { furnitureRectFor, siteOf } from '../plan'
import { chinaApartmentPlan } from '../mockups/chinaApartment'
import type { PlanState } from '../types'

export const roomOptionsFixture: PlanState = {
  site: { w: 10, h: 8, unit: 1 },
  rooms: [
    { id: 'r', name: 'Living / work', kind: 'living', x: 10, y: 10, w: 60, h: 60 },
    { id: 'other', name: 'Other room', kind: 'studio', x: 80, y: 10, w: 18, h: 60 },
  ],
  openings: [
    { id: 'door', type: 'door', x: 10, y: 35, rotation: 90, widthM: 1.1 },
    { id: 'window', type: 'window', x: 40, y: 10, rotation: 0, widthM: 2 },
  ],
  furniture: [
    { id: 'desk', kind: 'desk', x: 20, y: 20, rotated: false, wM: 1.6, dM: .8 },
    { id: 'sofa', kind: 'sofa', x: 40, y: 30, rotated: false },
    { id: 'storage', kind: 'wardrobe', x: 60, y: 15, rotated: false, wM: 1.1, dM: .55 },
    { id: 'fixture', kind: 'wc', x: 65, y: 58, rotated: false },
    { id: 'outside', kind: 'desk', x: 82, y: 20, rotated: false },
  ],
  systems: { solar: false, insulation: false, climate: false, lighting: false },
}

describe('local room options', () => {
  it('offers distinct valid arrangements without mutating any input or fixed geometry', () => {
    const plan = structuredClone(roomOptionsFixture), before = JSON.stringify(plan), room = plan.rooms[0]
    const result = generateRoomOptions(plan, room)
    expect(result.options).toHaveLength(3)
    expect(new Set(result.options.map(o => JSON.stringify(o.furniture))).size).toBe(3)
    expect(JSON.stringify(plan)).toBe(before)
    for (const option of result.options) {
      expect(roomOptionIssues(plan, room, option.furniture)).toEqual([])
      const applied = applyRoomOption(plan, room, option)!
      expect(applied.rooms).toBe(plan.rooms)
      expect(applied.openings).toBe(plan.openings)
      expect(applied.systems).toBe(plan.systems)
      expect(applied.site).toBe(plan.site)
      const inventory = (p: PlanState) => p.furniture.map(f => ({ id: f.id, kind: f.kind, wM: f.wM, dM: f.dM }))
      expect(inventory(applied)).toEqual(inventory(plan))
      expect(applied.furniture.find(f => f.id === 'fixture')).toEqual(plan.furniture.find(f => f.id === 'fixture'))
      expect(applied.furniture.find(f => f.id === 'outside')).toEqual(plan.furniture.find(f => f.id === 'outside'))
      const site = siteOf(plan)
      for (const f of applied.furniture.filter(f => !['outside'].includes(f.id))) {
        const r = furnitureRectFor(f, site)
        expect(r.x).toBeGreaterThanOrEqual(room.x - 1e-6)
        expect(r.y).toBeGreaterThanOrEqual(room.y - 1e-6)
        expect(r.x + r.w).toBeLessThanOrEqual(room.x + room.w + 1e-6)
        expect(r.y + r.h).toBeLessThanOrEqual(room.y + room.h + 1e-6)
      }
    }
  })

  it('reuses cached results and is deterministic on a fresh plan', () => {
    const plan = structuredClone(roomOptionsFixture)
    const first = generateRoomOptions(plan, plan.rooms[0])
    expect(generateRoomOptions(plan, plan.rooms[0])).toBe(first)
    const fresh = structuredClone(plan)
    expect(generateRoomOptions(fresh, fresh.rooms[0])).toEqual(first)
  })

  it('rejects stale and invented options instead of moving another inventory', () => {
    const plan = structuredClone(roomOptionsFixture), room = plan.rooms[0]
    const option = generateRoomOptions(plan, room).options[0]
    expect(applyRoomOption({ ...plan, openings: [] }, room, option)).toBeNull()
    expect(applyRoomOption(plan, room, { ...option, furniture: [] })).toBeNull()
    option.furniture[0].wM = .1
    expect(applyRoomOption(plan, room, option)).toBeNull()
  })

  it('measures the centre and the nearest desk/window gap in metres', () => {
    const plan = structuredClone(roomOptionsFixture)
    expect(measureRoom(plan, plan.rooms[0]).centreClearanceM).toBe(0)
    expect(measureRoom(plan, plan.rooms[0]).nearestWindowM).toBeCloseTo(Math.hypot(.4, .8))
    const noWindows = { ...plan, openings: plan.openings.filter(o => o.type !== 'window') }
    expect(measureRoom(noWindows, noWindows.rooms[0]).nearestWindowM).toBeNull()
    expect(generateRoomOptions(noWindows, noWindows.rooms[0]).options.every(o => o.goal !== 'window')).toBe(true)
  })

  it('keeps empty and fixture-only rooms unchanged with an explanation', () => {
    const plan = { ...structuredClone(roomOptionsFixture), furniture: [] }
    expect(generateRoomOptions(plan, plan.rooms[0]).reason).toMatch(/Add movable furniture/)
    const fixtures = { ...plan, furniture: roomOptionsFixture.furniture.filter(f => f.kind === 'wc') }
    expect(generateRoomOptions(fixtures, fixtures.rooms[0]).options).toEqual([])
  })

  it('reports a bounded-search failure rather than shrinking oversized furniture', () => {
    const plan = structuredClone(roomOptionsFixture)
    plan.rooms = [{ ...plan.rooms[0], w: 20, h: 20 }]
    plan.openings = []
    plan.furniture = [{ id: 'big', kind: 'bed', x: 10, y: 10, rotated: false, wM: 3, dM: 1.5 }]
    const before = JSON.stringify(plan)
    expect(generateRoomOptions(plan, plan.rooms[0]).reason).toMatch(/No alternative found/)
    expect(JSON.stringify(plan)).toBe(before)
  })

  it('refuses ambiguous rooms, crossing pieces and unfinished wall obstacles', () => {
    const overlap = structuredClone(roomOptionsFixture)
    overlap.rooms[1].x = 60
    expect(generateRoomOptions(overlap, overlap.rooms[0]).reason).toMatch(/overlapping rooms/)
    const crossing = structuredClone(roomOptionsFixture)
    crossing.rooms[1].x = 70
    crossing.furniture[2].wM = 2
    expect(generateRoomOptions(crossing, crossing.rooms[0]).reason).toMatch(/crosses into another room/)
    const wall = { ...structuredClone(roomOptionsFixture), walls: [{ id: 'wall', x1: 10, y1: 40, x2: 50, y2: 40 }] }
    expect(generateRoomOptions(wall, wall.rooms[0]).reason).toMatch(/pencil walls/)
  })

  it('preserves wide-door buffers and refuses moving a blocked WC fixture', () => {
    const plan = structuredClone(roomOptionsFixture)
    plan.furniture[3] = { ...plan.furniture[3], x: 11, y: 34 }
    expect(generateRoomOptions(plan, plan.rooms[0]).reason).toMatch(/fixed fixture/)
    expect(roomOptionIssues(plan, plan.rooms[0], plan.furniture)).toContain('Furniture enters a door buffer.')
  })

  it('caps inventory and bounds sample alternatives', () => {
    const crowded = structuredClone(roomOptionsFixture)
    crowded.furniture = Array.from({ length: 9 }, (_, i) => ({ ...crowded.furniture[0], id: `f${i}` }))
    expect(generateRoomOptions(crowded, crowded.rooms[0]).reason).toMatch(/eight movable pieces/)
    for (const room of chinaApartmentPlan.rooms) {
      const result = generateRoomOptions(chinaApartmentPlan, room)
      expect(result.options.length).toBeLessThanOrEqual(3)
      for (const option of result.options) expect(roomOptionIssues(chinaApartmentPlan, room, option.furniture)).toEqual([])
    }
  })

  it('keeps a thousand-piece imported inventory out of the local beam search', () => {
    const plan = structuredClone(roomOptionsFixture)
    plan.site = { w: 200, h: 200, unit: 1 }
    plan.rooms = [
      { ...plan.rooms[0], x: 1, y: 1, w: 2.5, h: 2.5 },
      { ...plan.rooms[1], x: 25, y: 25, w: 50, h: 50 },
    ]
    plan.openings = []
    plan.furniture = Array.from({ length: 1000 }, (_, i) => ({
      id: `f${i}`, kind: 'desk', rotated: false, wM: .5, dM: .3,
      x: i < 8 ? 1.1 + i % 4 * .4 : 25.1 + i % 32,
      y: i < 8 ? 1.1 + Math.floor(i / 4) * .4 : 25.1 + Math.floor(i / 32),
    }))
    // Count work on remote coordinates, independent of CPU contention. The
    // beam must never repeatedly visit them; initial validation/output may.
    const alone = { ...plan, furniture: plan.furniture.slice(0, 8) }
    const local = generateRoomOptions(alone, alone.rooms[0])
    let remoteReads = 0
    const budget = (plan.furniture.length - 8) * 100
    for (const piece of plan.furniture.slice(8)) {
      const x = piece.x
      Object.defineProperty(piece, 'x', { enumerable: true, get() {
        if (++remoteReads > budget) throw new Error('Remote furniture entered repeated search work')
        return x
      } })
    }
    const result = generateRoomOptions(plan, plan.rooms[0])
    expect(remoteReads).toBeGreaterThan(0)
    expect(remoteReads).toBeLessThanOrEqual(budget)
    expect(result.options.map(o => o.furniture.slice(0, 8))).toEqual(local.options.map(o => o.furniture))
    expect(result.options.length).toBeGreaterThan(0)
    for (const option of result.options) expect(option.furniture.slice(8)).toEqual(plan.furniture.slice(8))
    // Deterministic read counts, not time; the timeout only absorbs a saturated CI machine.
  }, 30_000)
})
