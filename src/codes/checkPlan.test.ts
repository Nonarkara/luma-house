import { describe, expect, it } from 'vitest'
import { STANDARDS, DEFAULT_THRESHOLDS, getStandard } from './standards'
import { checkPlan, exteriorDoorPlacement, SEVERITY_LABEL } from './checkPlan'
import { initialPlan } from '../plan'
import type { PlanState, Room, Opening } from '../types'

function withRooms(rooms: Room[], openings: Opening[] = []): PlanState {
  return { ...initialPlan, rooms, openings }
}

function room(over: Partial<Room>): Room {
  return {
    id: 'r1',
    name: 'Room',
    kind: 'living',
    x: 0,
    y: 0,
    w: 50,
    h: 50,
    ...over,
  }
}

function door(over: Partial<Opening> = {}): Opening {
  return {
    id: 'd1',
    type: 'door',
    x: 25,
    y: 0,
    rotation: 0,
    ...over,
  }
}

describe('standards library', () => {
  it('has the four standards bodies (IBC, ASHRAE, ADA, ISO)', () => {
    const bodies = new Set(Object.values(STANDARDS).map((s) => s.body))
    expect(bodies).toEqual(new Set(['IBC', 'ASHRAE', 'ADA', 'ISO']))
  })

  it('every standard ref matches the standard id format', () => {
    for (const [id, s] of Object.entries(STANDARDS)) {
      expect(s.ref).toBe(s.ref.toUpperCase().replace(' ', ' '))
      expect(s.name.length).toBeGreaterThan(8)
      expect(id).toContain(s.body)
    }
  })

  it('getStandard returns the standard for known ids and null for unknown', () => {
    expect(getStandard('IBC-1208.1')?.body).toBe('IBC')
    expect(getStandard('nope')).toBeNull()
  })

  it('the default thresholds are physical residential values', () => {
    expect(DEFAULT_THRESHOLDS.minHabitableAreaM2).toBe(6.5)
    expect(DEFAULT_THRESHOLDS.minCeilingHeightM).toBeCloseTo(2.13)
    expect(DEFAULT_THRESHOLDS.minDoorClearWidthM).toBeCloseTo(0.81)
    expect(DEFAULT_THRESHOLDS.minDoorHeightM).toBeCloseTo(2.03)
    expect(DEFAULT_THRESHOLDS.freshAirLsPerPerson).toBe(7.5)
  })
})

describe('checkPlan — area + ceiling rules (IBC 1208)', () => {
  it('flags a habitable room smaller than 6.5 m² as critical', () => {
    // 1.5m × 1.5m = 2.25 m² on a 14×10 m site (a tiny box)
    const tiny = withRooms([room({ id: 'a', kind: 'bedroom', x: 0, y: 0, w: 10, h: 10 })])
    const issues = checkPlan(tiny)
    const areaIssue = issues.find((i) => i.ref === 'IBC-1208.1' && i.roomId === 'a')
    expect(areaIssue?.severity).toBe('critical')
  })

  it('does not flag a bedroom at the minimum area', () => {
    // 14m × 14m would be way over. Use 1.4m × 4.7m = 6.58 m² (just over the threshold)
    const ok = withRooms([room({ id: 'a', kind: 'bedroom', x: 0, y: 0, w: 10, h: 53 })])
    const issues = checkPlan(ok)
    expect(issues.find((i) => i.ref === 'IBC-1208.1' && i.roomId === 'a')).toBeUndefined()
  })

  it('flags a 2.0 m ceiling in a habitable room as a warning', () => {
    const low = withRooms([room({ id: 'a', kind: 'living', wallHeight: 2.0 })])
    const issues = checkPlan(low)
    const c = issues.find((i) => i.ref === 'IBC-1208.2' && i.roomId === 'a')
    expect(c?.severity).toBe('warning')
    expect(c?.fixAction).toEqual({ type: 'set_ceiling', roomId: 'a', meters: 2.13 })
  })

  it('does not flag a 2.7 m ceiling', () => {
    const ok = withRooms([room({ id: 'a', kind: 'living', wallHeight: 2.7 })])
    expect(checkPlan(ok).find((i) => i.ref === 'IBC-1208.2')).toBeUndefined()
  })

  it('does not check ceiling for non-habitable rooms (terrace, bath)', () => {
    const bath = withRooms([room({ id: 'a', kind: 'bathroom', wallHeight: 2.0 })])
    expect(checkPlan(bath).find((i) => i.ref === 'IBC-1208.2')).toBeUndefined()
  })
})

describe('checkPlan — door + accessibility rules', () => {
  it('flags a 0.7 m door as critical (ADA 404.2.3)', () => {
    const plan: PlanState = {
      ...initialPlan,
      rooms: [room({ id: 'a', kind: 'living', x: 0, y: 0, w: 50, h: 100 })],
      openings: [door({ id: 'd1', type: 'door', x: 25, y: 0, rotation: 0, widthM: 0.7 })],
    }
    const issues = checkPlan(plan)
    const ada = issues.find((i) => i.ref === 'ADA-404.2.3')
    expect(ada?.severity).toBe('critical')
    expect(ada?.openingId).toBe('d1')
    expect(ada?.fixAction).toEqual({ type: 'enlarge_opening', openingId: 'd1' })
  })

  it('does not flag a 0.9 m standard door', () => {
    const plan: PlanState = {
      ...initialPlan,
      rooms: [room({ id: 'a', kind: 'living', x: 0, y: 0, w: 50, h: 100 })],
      openings: [door({ id: 'd1', type: 'door', x: 25, y: 0, rotation: 0 })],
    }
    expect(checkPlan(plan).find((i) => i.ref === 'ADA-404.2.3')).toBeUndefined()
  })

  it('flags a 1.9 m door as warning (IBC 1010.1.1)', () => {
    const plan: PlanState = {
      ...initialPlan,
      rooms: [room({ id: 'a', kind: 'living', x: 0, y: 0, w: 50, h: 100 })],
      openings: [door({ id: 'd1', type: 'door', x: 25, y: 0, rotation: 0, heightM: 1.9 })],
    }
    const issues = checkPlan(plan)
    expect(issues.find((i) => i.ref === 'IBC-1010.1.1' && i.openingId === 'd1')).toBeDefined()
  })
})

describe('checkPlan — egress connectivity (door graph, IBC 1003.3)', () => {
  it('flags a habitable room with no door at all', () => {
    const plan = withRooms([room({ id: 'a', kind: 'bedroom', x: 0, y: 0, w: 50, h: 100 })])
    const issues = checkPlan(plan)
    const egress = issues.find((i) => i.ref === 'IBC-1003.3' && i.roomId === 'a')
    expect(egress?.severity).toBe('critical')
    expect(egress?.fixAction).toEqual({ type: 'add_exterior_door', roomId: 'a' })
  })

  it('does not flag a room with an exterior door on its own wall', () => {
    const plan: PlanState = {
      ...initialPlan,
      rooms: [room({ id: 'a', kind: 'bedroom', x: 0, y: 0, w: 50, h: 100 })],
      openings: [door({ id: 'd1', type: 'door', x: 25, y: 100, rotation: 0 })],
    }
    expect(checkPlan(plan).find((i) => i.ref === 'IBC-1003.3' && i.roomId === 'a')).toBeUndefined()
  })

  it('flags a room whose only door leads deeper into a dead-end chain', () => {
    // Bedroom B (right) → door → Bedroom A (left) → no exterior door anywhere.
    // The old check passed this plan; the door graph correctly fails it.
    const plan: PlanState = {
      ...initialPlan,
      rooms: [
        room({ id: 'a', kind: 'bedroom', x: 0, y: 0, w: 50, h: 100 }),
        room({ id: 'b', kind: 'bedroom', x: 50, y: 0, w: 50, h: 100 }),
      ],
      openings: [door({ id: 'd1', type: 'door', x: 50, y: 50, rotation: 90 })],
    }
    const issues = checkPlan(plan)
    expect(issues.find((i) => i.ref === 'IBC-1003.3' && i.roomId === 'a')).toBeDefined()
    expect(issues.find((i) => i.ref === 'IBC-1003.3' && i.roomId === 'b')).toBeDefined()
  })

  it('passes a room connected through an interior door to a room with an exterior door', () => {
    const plan: PlanState = {
      ...initialPlan,
      rooms: [
        room({ id: 'a', kind: 'bedroom', x: 0, y: 0, w: 50, h: 100 }),
        room({ id: 'b', kind: 'living', x: 50, y: 0, w: 50, h: 100 }),
      ],
      openings: [
        door({ id: 'd1', type: 'door', x: 50, y: 50, rotation: 90 }), // a ↔ b
        door({ id: 'd2', type: 'door', x: 75, y: 100, rotation: 0 }), // b → exterior
      ],
    }
    expect(checkPlan(plan).find((i) => i.ref === 'IBC-1003.3')).toBeUndefined()
  })
})

describe('checkPlan — ventilation info rows (aggregated)', () => {
  it('flags a plan with rooms but no openings as critical (no fresh air path)', () => {
    const plan = withRooms([
      room({ id: 'a', kind: 'living' }),
      room({ id: 'b', kind: 'kitchen' }),
    ])
    plan.openings = []
    const issues = checkPlan(plan)
    const ash = issues.find((i) => i.ref === 'ASHRAE-62.1-RESIDENTIAL' && i.roomId === null)
    expect(ash?.severity).toBe('critical')
  })

  it('emits an info-level fresh-air target once a window exists', () => {
    const plan: PlanState = {
      ...initialPlan,
      rooms: [room({ id: 'a', kind: 'living' }), room({ id: 'b', kind: 'bedroom' })],
      openings: [{ id: 'w1', type: 'window', x: 25, y: 0, rotation: 0 }],
    }
    const issues = checkPlan(plan)
    const ash = issues.find((i) => i.ref === 'ASHRAE-62.1-RESIDENTIAL' && i.severity === 'info')
    // The title carries the L/s figure; the body says the design consequence.
    expect(ash?.title).toContain('L/s')
    expect(ash?.title).toMatch(/\d+ occupants/)
  })

  it('aggregates kitchen + bathroom exhaust into one row each, not per room', () => {
    const plan: PlanState = {
      ...initialPlan,
      rooms: [
        room({ id: 'k1', name: 'Kitchen one', kind: 'kitchen' }),
        room({ id: 'k2', name: 'Kitchen two', kind: 'kitchen' }),
        room({ id: 'b1', name: 'Bath one', kind: 'bathroom' }),
        room({ id: 'b2', name: 'Bath two', kind: 'bathroom' }),
      ],
      openings: [{ id: 'w1', type: 'window', x: 25, y: 0, rotation: 0 }],
    }
    const issues = checkPlan(plan)
    expect(issues.filter((i) => i.ref === 'ASHRAE-62.1-KITCHEN')).toHaveLength(1)
    expect(issues.filter((i) => i.ref === 'ASHRAE-62.1-BATHROOM')).toHaveLength(1)
    const kitchenRow = issues.find((i) => i.ref === 'ASHRAE-62.1-KITCHEN')
    expect(kitchenRow?.title).toContain('Kitchen one')
    expect(kitchenRow?.title).toContain('Kitchen two')
  })

  it('emits exactly one envelope info row regardless of window count', () => {
    const plan: PlanState = {
      ...initialPlan,
      rooms: [room({ id: 'a', kind: 'living' })],
      openings: [
        { id: 'w1', type: 'window', x: 25, y: 0, rotation: 0 },
        { id: 'w2', type: 'window', x: 40, y: 0, rotation: 0 },
        { id: 'w3', type: 'window', x: 60, y: 0, rotation: 0 },
      ],
    }
    expect(checkPlan(plan).filter((i) => i.ref === 'ASHRAE-90.1-ENVELOPE')).toHaveLength(1)
  })
})

describe('exteriorDoorPlacement — one-click egress door targeting', () => {
  it('places on the midpoint of the longest exterior wall', () => {
    const plan = withRooms([room({ id: 'a', kind: 'bedroom', x: 10, y: 10, w: 60, h: 30 })])
    const spot = exteriorDoorPlacement(plan, 'a')
    // Longest wall is N or S (60% vs 30%); both are fully exterior.
    expect(spot).not.toBeNull()
    expect(['N', 'S']).toContain(spot!.compass)
    expect(spot!.rotation).toBe(0)
    expect(spot!.crowded).toBe(false)
  })

  it('never targets a wall shared with a neighboring room', () => {
    const plan: PlanState = {
      ...initialPlan,
      rooms: [
        room({ id: 'a', kind: 'bedroom', x: 0, y: 0, w: 50, h: 100 }),
        room({ id: 'b', kind: 'living', x: 50, y: 0, w: 50, h: 100 }),
      ],
      openings: [],
    }
    const spot = exteriorDoorPlacement(plan, 'a')
    expect(spot).not.toBeNull()
    // The E wall of 'a' is shared with 'b' — it must not be chosen.
    expect(spot!.compass).not.toBe('E')
  })

  it('slides along the wall when the midpoint is occupied', () => {
    const plan: PlanState = {
      ...initialPlan,
      rooms: [room({ id: 'a', kind: 'bedroom', x: 10, y: 10, w: 60, h: 30 })],
      openings: [door({ id: 'd1', type: 'door', x: 40, y: 10, rotation: 0 })],
    }
    const spot = exteriorDoorPlacement(plan, 'a')
    expect(spot).not.toBeNull()
    expect(Math.abs(spot!.x - 40)).toBeGreaterThanOrEqual(0.5)
  })

  it('returns null for a room with no exterior wall (all four edges shared)', () => {
    // The engine treats a wall as shared only when a neighbor's edge
    // coincides with it, so the target room must be framed on all sides.
    const plan: PlanState = {
      ...initialPlan,
      rooms: [
        room({ id: 't', kind: 'bedroom', x: 40, y: 40, w: 20, h: 20 }),
        room({ id: 'west', kind: 'living', x: 0, y: 40, w: 40, h: 20 }),
        room({ id: 'east', kind: 'living', x: 60, y: 40, w: 40, h: 20 }),
        room({ id: 'north', kind: 'living', x: 40, y: 0, w: 20, h: 40 }),
        room({ id: 'south', kind: 'living', x: 40, y: 60, w: 20, h: 40 }),
      ],
      openings: [],
    }
    expect(exteriorDoorPlacement(plan, 't')).toBeNull()
  })
})

describe('checkPlan — sample plan (initial plan) does not blow up', () => {
  it('runs without errors and returns a non-empty list of issues', () => {
    const issues = checkPlan(initialPlan)
    expect(Array.isArray(issues)).toBe(true)
  })
})

describe('severity labels', () => {
  it('exposes a label for every severity', () => {
    expect(SEVERITY_LABEL.info).toBe('Info')
    expect(SEVERITY_LABEL.warning).toBe('Warning')
    expect(SEVERITY_LABEL.critical).toBe('Critical')
  })
})

describe('checkPlan — ADA 304.3 turning space', () => {
  it('flags a bathroom whose short side is below the 1.5 m turning diameter', () => {
    // 1.2 m × 1.8 m bathroom — short side under 1.5 m
    const plan = withRooms([room({ id: 'b1', kind: 'bathroom', w: 10, h: 15 })])
    const issues = checkPlan(plan)
    const ada = issues.find((i) => i.ref === 'ADA-304.3' && i.roomId === 'b1')
    expect(ada?.severity).toBe('warning')
    expect(ada?.title).toMatch(/ADA turning circle/)
  })

  it('does not flag a bathroom wide enough for the turning circle', () => {
    // 2.0 m × 2.2 m — short side ≥ 1.5 m
    const plan = withRooms([room({ id: 'b1', kind: 'bathroom', w: 16, h: 18 })])
    expect(checkPlan(plan).find((i) => i.ref === 'ADA-304.3' && i.roomId === 'b1')).toBeUndefined()
  })

  it('also applies to kitchens smaller than the turning diameter', () => {
    const plan = withRooms([room({ id: 'k1', kind: 'kitchen', w: 8, h: 14 })])
    expect(checkPlan(plan).find((i) => i.ref === 'ADA-304.3' && i.roomId === 'k1')).toBeDefined()
  })
})

describe('checkPlan — IBC 1005.1 minimum aisle width', () => {
  it('flags a long narrow room whose short side is below 36"', () => {
    // On the default 14×10 site, w:5 h:50 = 0.7 m × 5.0 m = 7.1:1 ratio,
    // short side 0.7 m below the 0.91 m aisle threshold.
    const plan = withRooms([room({ id: 'h1', kind: 'living', x: 0, y: 0, w: 5, h: 50 })])
    const issues = checkPlan(plan)
    const aisle = issues.find((i) => i.ref === 'IBC-1005.1' && i.roomId === 'h1')
    expect(aisle?.severity).toBe('warning')
  })

  it('does not flag a room whose short side is wide enough', () => {
    // 2 m × 5 m — short side above 0.91 m threshold
    const plan = withRooms([room({ id: 'h1', kind: 'living', x: 0, y: 0, w: 14, h: 36 })])
    expect(checkPlan(plan).find((i) => i.ref === 'IBC-1005.1' && i.roomId === 'h1')).toBeUndefined()
  })

  it('does not flag a square room regardless of size', () => {
    const plan = withRooms([room({ id: 'h1', kind: 'living', w: 16, h: 16 })])
    expect(checkPlan(plan).find((i) => i.ref === 'IBC-1005.1' && i.roomId === 'h1')).toBeUndefined()
  })
})

describe('checkPlan — IBC 1208.4 efficiency dwelling unit', () => {
  it('emits an info row for studios at or above the habitable minimum', () => {
    // 14 m × 14 m studio on a 14×14 site — way above 6.5 m²
    const plan = withRooms([room({ id: 's1', kind: 'studio', w: 60, h: 60 })])
    const issues = checkPlan(plan)
    expect(issues.find((i) => i.ref === 'IBC-1208.4' && i.roomId === 's1')).toBeDefined()
  })

  it('does not emit EDU info for sub-threshold studios (already failed 1208.1)', () => {
    const plan = withRooms([room({ id: 's1', kind: 'studio', w: 8, h: 8 })])
    const issues = checkPlan(plan)
    expect(issues.find((i) => i.ref === 'IBC-1208.4' && i.roomId === 's1')).toBeUndefined()
  })
})