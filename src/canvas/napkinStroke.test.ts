import { describe, expect, it } from 'vitest'
import { applyNapkinStroke } from './napkinStroke'
import type { PlanState, Room } from '../types'
import { defaultSite, roomAreaFor } from '../plan'

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

  it.each([0.5, 0.7])('one loop with %s m corner overshoot is exactly one room', (over) => {
    const at = (mx: number, my: number) => ({ x: (mx / site.w) * 100, y: (my / site.h) * 100 })
    const x1 = 4
    const x2 = 9
    const y1 = 3
    const y2 = 7
    const strokes = [
      [at(x1 - over, y1), at(x2 + over, y1)],
      [at(x2, y1 - over), at(x2, y2 + over)],
      [at(x2 + over, y2), at(x1 - over, y2)],
      [at(x1, y2 + over), at(x1, y1 - over)],
    ]
    let current = plan()
    for (const stroke of strokes) {
      const next = applyNapkinStroke(current, stroke, site)
      expect(next.plan).not.toBeNull()
      current = next.plan!
    }
    expect(current.rooms).toHaveLength(1)
    expect(current.walls ?? []).toHaveLength(0)
    const room = current.rooms[0]
    const area = (room.w / 100) * site.w * (room.h / 100) * site.h
    expect(area).toBeGreaterThan(15)
    expect(area).toBeLessThan(36)
    expect(current.rooms[0].name).toBe('Living')
  })

  it('closes four walls whose corners miss by about 0.5 m', () => {
    const at = (mx: number, my: number) => ({ x: (mx / site.w) * 100, y: (my / site.h) * 100 })
    let current = plan()
    const strokes = [
      [at(4, 3), at(8, 3)],
      [at(8.5, 3), at(8.5, 6)],
      [at(8, 6), at(4, 6)],
      [at(4, 6), at(4, 3)],
    ]
    for (const stroke of strokes) {
      const next = applyNapkinStroke(current, stroke, site)
      expect(next.plan).not.toBeNull()
      current = next.plan!
    }
    expect(current.rooms.length).toBeGreaterThanOrEqual(1)
    const area = (current.rooms[0].w / 100) * site.w * (current.rooms[0].h / 100) * site.h
    expect(area).toBeGreaterThan(0)
    expect(current.walls ?? []).toHaveLength(0)
  })

  it('reports Corners don\'t meet when a gap is wider than 0.6 m', () => {
    const at = (mx: number, my: number) => ({ x: (mx / site.w) * 100, y: (my / site.h) * 100 })
    let current = plan()
    let toast = ''
    let note: { x: number; y: number } | undefined
    const strokes = [
      [at(4, 3), at(8, 3)],
      [at(8.9, 3), at(8.9, 6)],
      [at(8, 6), at(4, 6)],
      [at(4, 6), at(4, 3)],
    ]
    for (const stroke of strokes) {
      const next = applyNapkinStroke(current, stroke, site)
      expect(next.plan).not.toBeNull()
      toast = next.toast
      note = next.plan ? next.cornerNote ?? note : note
      current = next.plan!
    }
    expect(current.rooms).toHaveLength(0)
    expect(toast).toBe("Corners don't meet")
    expect(note?.x).toBeGreaterThan(0)
    expect(note?.y).toBeGreaterThan(0)
  })

  it('closes four walls whose corners miss by less than 0.3 m', () => {
    const gapX = (0.18 / site.w) * 100
    const gapY = (0.18 / site.h) * 100
    let current = plan()
    const strokes = [
      [{ x: 22, y: 30 }, { x: 50, y: 30.2 }],
      [{ x: 50 + gapX, y: 30 + gapY }, { x: 50 + gapX, y: 55 }],
      [{ x: 50, y: 55 + gapY }, { x: 22, y: 55 + gapY }],
      [{ x: 22 - gapX, y: 55 }, { x: 22 - gapX, y: 30 }],
    ]
    for (const stroke of strokes) {
      const next = applyNapkinStroke(current, stroke, site)
      expect(next.plan).not.toBeNull()
      current = next.plan!
    }
    expect(current.rooms.length).toBeGreaterThanOrEqual(1)
    const area = (current.rooms[0].w / 100) * site.w * (current.rooms[0].h / 100) * site.h
    expect(area).toBeGreaterThan(0)
  })

  it('reads a short stroke across an interior wall of 1 m or less as a door', () => {
    const bed: Room = { id: 'bed', name: 'Bedroom', kind: 'bedroom', x: 50, y: 10, w: 30, h: 40 }
    const result = applyNapkinStroke(plan([living, bed]), [
      { x: 48, y: 28 },
      { x: 52, y: 28 },
    ], site)
    expect(result.plan!.openings[0].type).toBe('door')
    expect(result.plan!.openings[0].rotation).toBe(90)
  })

  it('rejects a tap', () => {
    const result = applyNapkinStroke(plan(), [{ x: 20, y: 20 }, { x: 20.2, y: 20.1 }], site)
    expect(result.plan).toBeNull()
  })
})

// From Cursor PR #5: a completed rough loop must not leave its short tails.
describe('closing a rough pencil loop', () => {
  const at = (mx: number, my: number) => ({ x: mx / site.w * 100, y: my / site.h * 100 })
  function close(over: number, extra: Partial<PlanState> = {}) {
    let current = plan([], extra)
    for (const stroke of [
      [at(4 - over, 3), at(9 + over, 3)],
      [at(9, 3 - over), at(9, 7 + over)],
      [at(9 + over, 7), at(4 - over, 7)],
      [at(4, 7 + over), at(4, 3 - over)],
    ]) {
      const result = applyNapkinStroke(current, stroke, site)
      expect(result.plan).not.toBeNull()
      current = result.plan!
    }
    return current
  }
  it.each([0.5, 0.7])('consumes %s m tails without changing the enclosed room', over => {
    const result = close(over)
    expect(result.rooms).toHaveLength(1)
    expect(result.walls).toHaveLength(0)
    expect(roomAreaFor(result.rooms[0], site)).toBeGreaterThan(19)
    expect(roomAreaFor(result.rooms[0], site)).toBeLessThan(21)
  })
  it('preserves an unrelated wall whose coordinate crosses the room interior', () => {
    const remote = { id: 'remote', x1: 75, y1: 30, x2: 95, y2: 30 }
    const result = close(.5, { walls: [remote] })
    expect(result.rooms).toHaveLength(1)
    expect(result.walls).toEqual([remote])
  })
  it('preserves a detached saved fragment inside the tail allowance', () => {
    const detached = { id: 'detached', x1: 3.35 / site.w * 100, y1: 30, x2: 3.45 / site.w * 100, y2: 30 }
    const result = close(.5, { walls: [detached] })
    expect(result.rooms).toHaveLength(1)
    expect(result.walls).toEqual([detached])
  })
  it('preserves a long wall that continues beyond the new room', () => {
    const extension = { id: 'extension', x1: 4 / site.w * 100, y1: 30, x2: 13 / site.w * 100, y2: 30 }
    const result = close(.5, { walls: [extension] })
    expect(result.rooms.length).toBeGreaterThanOrEqual(1)
    expect(result.walls).toContainEqual(extension)
  })
})
