import { describe, expect, it } from 'vitest'
import type { PlanState } from '../types'
import { daylightPotential } from './daylight'
import { egressRoutes } from './egress'
import { windFlowPotential } from './windFlow'

const room = { id: 'room', name: 'Room', kind: 'living' as const, x: 20, y: 20, w: 40, h: 40, wallHeight: 3 }
const systems = { solar: false, insulation: false, climate: false, lighting: false }

function plan(openings: PlanState['openings']): PlanState {
  return { site: { w: 10, h: 10, unit: 1 }, rooms: [room], openings, furniture: [], systems }
}

describe('daylightPotential', () => {
  it('shows no plan reach without an exterior window', () => {
    expect(daylightPotential(plan([]))[0].planCoverage).toBe(0)
  })

  it('shows a conservative reach band from an exterior window', () => {
    const result = daylightPotential(plan([{ id: 'window', type: 'window', x: 40, y: 20, rotation: 0 }]))[0]
    expect(result.bands).toHaveLength(1)
    expect(result.bands[0].reachM).toBeCloseTo(3.15)
    expect(result.planCoverage).toBeGreaterThan(0.7)
    expect(result.planCoverage).toBeLessThanOrEqual(1)
  })

  it('responds to window placement along a wide wall', () => {
    const wideRoom = { ...room, x: 10, y: 20, w: 80, h: 40 }
    const centered: PlanState = { site: { w: 20, h: 10, unit: 1 }, rooms: [wideRoom], openings: [{ id: 'center', type: 'window', x: 50, y: 20, rotation: 0 }], furniture: [], systems }
    const corner: PlanState = { ...centered, openings: [{ id: 'corner', type: 'window', x: 11, y: 20, rotation: 0 }] }
    expect(daylightPotential(centered)[0].planCoverage).toBeGreaterThan(daylightPotential(corner)[0].planCoverage)
  })
})

describe('windFlowPotential', () => {
  const openings: PlanState['openings'] = [
    { id: 'north', type: 'window', x: 40, y: 20, rotation: 0 },
    { id: 'south', type: 'window', x: 40, y: 60, rotation: 0 },
  ]

  it('does not invent ACH for a single-sided room', () => {
    const result = windFlowPotential(plan(openings.slice(0, 1)), 0, 3)[0]
    expect(result.mode).toBe('single-sided')
    expect(result.ach).toBeNull()
  })

  it('responds to wind speed and facade orientation', () => {
    const slow = windFlowPotential(plan(openings), 0, 2)[0]
    const fast = windFlowPotential(plan(openings), 0, 4)[0]
    const side = windFlowPotential(plan(openings), 90, 4)[0]
    expect(slow.mode).toBe('through-flow')
    expect(fast.ach!).toBeCloseTo(slow.ach! * 2)
    expect(side.ach).toBeNull()
  })

  it('requires a continuous internal-door route between exterior pressure faces', () => {
    const rooms: PlanState['rooms'] = [
      { id: 'west', name: 'West', kind: 'living', x: 10, y: 20, w: 40, h: 40 },
      { id: 'east', name: 'East', kind: 'living', x: 50, y: 20, w: 40, h: 40 },
    ]
    const exteriorOpenings: PlanState['openings'] = [
      { id: 'north', type: 'window', x: 30, y: 20, rotation: 0 },
      { id: 'south', type: 'window', x: 70, y: 60, rotation: 0 },
    ]
    const base: PlanState = { site: { w: 10, h: 10, unit: 1 }, rooms, openings: exteriorOpenings, furniture: [], systems }
    expect(windFlowPotential(base, 0, 3).map((item) => item.mode)).toEqual(['single-sided', 'single-sided'])

    const connected = { ...base, openings: [...exteriorOpenings, { id: 'transfer', type: 'door' as const, x: 50, y: 40, rotation: 90 as const }] }
    const result = windFlowPotential(connected, 0, 3)
    expect(result.map((item) => item.mode)).toEqual(['through-flow', 'through-flow'])
    expect(result.every((item) => item.note.includes('open internal door'))).toBe(true)
  })

  it('does not treat one exterior window plus an internal door as cross-ventilation', () => {
    const rooms: PlanState['rooms'] = [
      { id: 'west', name: 'West', kind: 'living', x: 10, y: 20, w: 40, h: 40 },
      { id: 'east', name: 'East', kind: 'living', x: 50, y: 20, w: 40, h: 40 },
    ]
    const connected: PlanState = {
      site: { w: 10, h: 10, unit: 1 },
      rooms,
      openings: [
        { id: 'north', type: 'window', x: 30, y: 20, rotation: 0 },
        { id: 'transfer', type: 'door', x: 50, y: 40, rotation: 90 },
      ],
      furniture: [],
      systems,
    }
    expect(windFlowPotential(connected, 0, 3).every((item) => item.mode !== 'through-flow')).toBe(true)
  })
})

describe('egressRoutes', () => {
  it('finds a direct exterior door', () => {
    const result = egressRoutes(plan([{ id: 'exit', type: 'door', x: 60, y: 40, rotation: 90 }]))[0]
    expect(result.connected).toBe(true)
    expect(result.distanceM).toBeGreaterThan(0)
    expect(result.doors).toEqual(['exit'])
  })

  it('does not infer a route when no door reaches outside', () => {
    const result = egressRoutes(plan([]))[0]
    expect(result.connected).toBe(false)
    expect(result.distanceM).toBeNull()
  })
})
