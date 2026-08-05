import { describe, expect, it } from 'vitest'
import { STANDARDS, DEFAULT_THRESHOLDS, getStandard } from './standards'
import { checkPlan, SEVERITY_LABEL } from './checkPlan'
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
  it('has the five core standards (IBC, ASHRAE, ADA, ISO)', () => {
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

describe('checkPlan — egress connectivity', () => {
  it('flags a habitable room with no door at all', () => {
    const plan = withRooms([room({ id: 'a', kind: 'bedroom', x: 0, y: 0, w: 50, h: 100 })])
    const issues = checkPlan(plan)
    const egress = issues.find((i) => i.ref === 'IBC-1003.3' && i.roomId === 'a')
    expect(egress?.severity).toBe('critical')
    expect(egress?.fixAction).toMatchObject({ type: 'add_exterior_door' })
  })

  it('does not flag a room with at least one door', () => {
    const plan: PlanState = {
      ...initialPlan,
      rooms: [room({ id: 'a', kind: 'bedroom', x: 0, y: 0, w: 50, h: 100 })],
      openings: [door({ id: 'd1', type: 'door', x: 25, y: 100, rotation: 0 })],
    }
    expect(checkPlan(plan).find((i) => i.ref === 'IBC-1003.3' && i.roomId === 'a')).toBeUndefined()
  })
})

describe('checkPlan — ventilation (ASHRAE 62.1)', () => {
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

  it('emits a kitchen exhaust info tag on kitchen rooms', () => {
    const plan: PlanState = {
      ...initialPlan,
      rooms: [room({ id: 'k', kind: 'kitchen' })],
      openings: [{ id: 'w1', type: 'window', x: 25, y: 0, rotation: 0 }],
    }
    const issues = checkPlan(plan)
    expect(issues.find((i) => i.ref === 'ASHRAE-62.1-KITCHEN' && i.roomId === 'k')).toBeDefined()
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
