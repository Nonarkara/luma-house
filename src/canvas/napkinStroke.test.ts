import { describe, expect, it } from 'vitest'
import { applyNapkinStroke } from './napkinStroke'
import type { PlanState, Room } from '../types'
import { defaultSite } from '../plan'

const site = defaultSite()

function plan(rooms: Room[] = [], extra: Partial<PlanState> = {}): PlanState {
  return {
    rooms,
    openings: [],
    furniture: [],
    walls: [],
    systems: { solar: false, insulation: false, climate: false, lighting: false },
    site,
    ...extra,
  }
}

const living: Room = { id: 'living', name: 'Living', kind: 'living', x: 10, y: 10, w: 40, h: 40 }

function box(x: number, y: number, w: number, h: number) {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
    { x, y },
  ]
}

describe('applyNapkinStroke', () => {
  it('turns a drawn box in empty space into a room', () => {
    const result = applyNapkinStroke(plan(), box(20, 20, 30, 28), site)
    expect(result.plan).not.toBeNull()
    if (!result.plan) return
    expect(result.plan.rooms).toHaveLength(1)
    expect(result.plan.rooms[0].w).toBeGreaterThanOrEqual(28)
    expect(result.selectRoom).toBe(result.plan.rooms[0].id)
  })

  it('reads a short tick on an exterior wall as a window', () => {
    const result = applyNapkinStroke(plan([living]), [
      { x: 30, y: 9.2 },
      { x: 32, y: 10.4 },
    ], site)
    expect(result.plan).not.toBeNull()
    expect(result.plan!.openings).toHaveLength(1)
    expect(result.plan!.openings[0].type).toBe('window')
  })

  it('reads a short tick on a shared wall as a door', () => {
    const bed: Room = { id: 'bed', name: 'Bedroom', kind: 'bedroom', x: 50, y: 10, w: 30, h: 40 }
    const result = applyNapkinStroke(plan([living, bed]), [
      { x: 49.5, y: 28 },
      { x: 50.5, y: 30 },
    ], site)
    expect(result.plan!.openings[0].type).toBe('door')
  })

  it('keeps a lone line as a wall until the rectangle closes', () => {
    const first = applyNapkinStroke(plan(), [
      { x: 20, y: 20 },
      { x: 55, y: 21 },
    ], site)
    expect(first.plan!.walls).toHaveLength(1)
    expect(first.plan!.rooms).toHaveLength(0)

    const walls = first.plan!.walls!
    const withThree = applyNapkinStroke(
      { ...first.plan!, walls: [
        walls[0],
        { id: 'w2', x1: 20, y1: 20, x2: 20, y2: 52 },
        { id: 'w3', x1: 20, y1: 52, x2: 55, y2: 52 },
      ] },
      [{ x: 55, y: 20 }, { x: 55, y: 52 }],
      site,
    )
    expect(withThree.plan!.rooms.length).toBeGreaterThanOrEqual(1)
    expect(withThree.plan!.rooms[0].w).toBeGreaterThanOrEqual(30)
  })

  it('splits a room with a line from wall to wall', () => {
    const result = applyNapkinStroke(plan([living]), [
      { x: 30, y: 10 },
      { x: 30, y: 50 },
    ], site)
    expect(result.plan!.rooms).toHaveLength(2)
    expect(result.plan!.rooms.every((room) => room.w >= 12 || room.h >= 12)).toBe(true)
  })

  it('turns a bed-sized box inside a room into a bed', () => {
    const result = applyNapkinStroke(plan([living]), box(14, 14, 14, 18), site)
    expect(result.plan!.furniture).toHaveLength(1)
    expect(result.plan!.furniture[0].kind).toBe('bed')
    expect(result.plan!.furniture[0].wM).toBeGreaterThan(1)
  })

  it('turns a small box in a bathroom into a WC', () => {
    const bath: Room = { id: 'bath', name: 'Bathroom', kind: 'bathroom', x: 10, y: 10, w: 20, h: 20 }
    const result = applyNapkinStroke(plan([bath]), box(12, 12, 4, 6), site)
    expect(result.plan!.furniture[0].kind).toBe('wc')
  })

  it('rejects a tap', () => {
    const result = applyNapkinStroke(plan(), [{ x: 20, y: 20 }, { x: 20.2, y: 20.1 }], site)
    expect(result.plan).toBeNull()
  })
})
