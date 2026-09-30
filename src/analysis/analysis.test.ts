import { describe, expect, it } from 'vitest'
import { analyze, exteriorWalls, crossVentilationScore, wallSunForDay, wallNeedsShade, thermalProfile, peakOutdoorC } from './index'
import type { WallSun } from './types'
import { initialPlan, locations } from '../plan'
import type { PlanState, Room } from '../types'

const BANGKOK = locations.Bangkok

function noFurniture(overrides: Partial<PlanState> = {}): PlanState {
  return { ...initialPlan, furniture: [], ...overrides }
}

describe('exteriorWalls', () => {
  it('finds four exterior walls for a single isolated room', () => {
    const rooms: Room[] = [
      { id: 'only', name: 'Only', kind: 'studio', x: 30, y: 30, w: 40, h: 40 },
    ]
    const walls = exteriorWalls({ rooms, openings: [], furniture: [], systems: { solar: true, insulation: true, climate: false, lighting: true } })
    const compasses = walls.map((w) => w.compass).sort()
    expect(compasses).toEqual(['E', 'N', 'S', 'W'])
  })

  it('treats shared walls between two rooms as interior, not exterior', () => {
    const rooms: Room[] = [
      { id: 'a', name: 'A', kind: 'studio', x: 10, y: 20, w: 40, h: 60 },
      { id: 'b', name: 'B', kind: 'studio', x: 50, y: 20, w: 40, h: 60 },
    ]
    const walls = exteriorWalls({ rooms, openings: [], furniture: [], systems: { solar: true, insulation: true, climate: false, lighting: true } })
    const aWalls = walls.filter((w) => w.roomId === 'a').map((w) => w.compass).sort()
    const bWalls = walls.filter((w) => w.roomId === 'b').map((w) => w.compass).sort()
    expect(aWalls).toEqual(['N', 'S', 'W'])
    expect(bWalls).toEqual(['E', 'N', 'S'])
  })

  it('subtracts only the shared portion of a partially adjacent wall', () => {
    const rooms: Room[] = [
      { id: 'a', name: 'A', kind: 'studio', x: 10, y: 10, w: 40, h: 40 },
      { id: 'b', name: 'B', kind: 'studio', x: 50, y: 20, w: 20, h: 20 },
    ]
    const walls = exteriorWalls({ rooms, openings: [], furniture: [], systems: { solar: false, insulation: false, climate: false, lighting: false }, site: { w: 10, h: 10, unit: 1 } })
    const eastA = walls.find((wall) => wall.roomId === 'a' && wall.compass === 'E')
    expect(eastA?.lengthPct).toBeCloseTo(20)
    expect(eastA?.lengthMeters).toBeCloseTo(2)
  })
})

describe('wallSunForDay', () => {
  /**
   * These are the facts a designer in Thailand most needs and most architects
   * get wrong, so they are asserted rather than assumed.
   */
  it('gives a Bangkok south wall ZERO sun at the summer solstice', () => {
    // Bangkok is 13.76 N and the solstice declination is +23.45, so the noon sun
    // stands at 90 - 13.76 + 23.45 = 99.7 deg: it passes NORTH of the zenith.
    // The sun is in the northern half of the sky all day near noon, so a south
    // wall sees none of it. This test previously asserted the opposite and
    // passed only because the azimuth was mirrored around 180, manufacturing a
    // phantom southern sun in the middle of a tropical day.
    const south = wallSunForDay(BANGKOK.latitude, 172, 'S')
    const north = wallSunForDay(BANGKOK.latitude, 172, 'N')
    expect(south.directMinutes).toBe(0)
    expect(north.directMinutes).toBeGreaterThan(600)
    expect(north.peakIntensity).toBeGreaterThan(0.9)
    expect(north.worstHour).toBe(12)
  })

  it('flips to the south wall in Bangkok winter', () => {
    // Declination is negative then, so the sun is back in the southern sky.
    const south = wallSunForDay(BANGKOK.latitude, 355, 'S')
    const north = wallSunForDay(BANGKOK.latitude, 355, 'N')
    expect(north.directMinutes).toBe(0)
    expect(south.directMinutes).toBeGreaterThan(600)
  })

  it('puts the strongest single-wall sun on the south at a mid-northern latitude', () => {
    // Shanghai is 31.23 N, north of the tropic: the sun never crosses the
    // zenith, so the south wall takes the noon sun square on (peak ~1.0). The
    // north wall still accumulates more total minutes in summer, because the
    // long summer day gives it four hours of low raking morning and evening
    // light — which is exactly why north rooms feel cool and pleasant in summer.
    const shanghai = locations['Shanghai']
    const south = wallSunForDay(shanghai.latitude, 172, 'S')
    const north = wallSunForDay(shanghai.latitude, 172, 'N')
    expect(south.peakIntensity).toBeGreaterThan(0.9)
    expect(south.worstHour).toBe(12)
    expect(north.peakIntensity).toBeLessThan(0.3) // raking, not perpendicular
  })

  it('gives a mid-northern north wall no sun at all in winter', () => {
    const north = wallSunForDay(locations['Shanghai'].latitude, 355, 'N')
    expect(north.directMinutes).toBe(0)
  })

  it('produces long direct-sun duration on the west wall in tropical summer', () => {
    const west = wallSunForDay(BANGKOK.latitude, 172, 'W')
    expect(west.directMinutes).toBeGreaterThan(180) // > 3 hours
    expect(west.peakIntensity).toBeGreaterThan(0.5)
  })

  it('marks a 4+ hour wall as needing shade', () => {
    expect(wallNeedsShade(0)).toBe(false)
    expect(wallNeedsShade(120)).toBe(false)
    expect(wallNeedsShade(241)).toBe(true)
    expect(wallNeedsShade(360)).toBe(true)
  })
})

describe('crossVentilationScore', () => {
  const living = initialPlan.rooms[0]

  it('scores a sealed room at 0', () => {
    const s = crossVentilationScore(noFurniture({ openings: [] }), living)
    expect(s.score).toBe(0)
  })

  it('scores a single-sided room at 0.25', () => {
    const s = crossVentilationScore(
      noFurniture({ openings: [{ id: 'w', type: 'window', x: 28, y: 6, rotation: 0 }] }),
      living,
    )
    expect(s.score).toBe(0.25)
  })

  it('scores opposing-window rooms at 0.75', () => {
    const s = crossVentilationScore(
      noFurniture({
        openings: [
          { id: 'w1', type: 'window', x: 28, y: 6, rotation: 0 },
          { id: 'w2', type: 'window', x: 28, y: 49, rotation: 0 },
        ],
      }),
      living,
    )
    expect(s.score).toBe(0.75)
  })
})

describe('thermalProfile', () => {
  it('runs cooler when insulation is on and ventilation is strong', () => {
    const room = initialPlan.rooms[0]
    const plan = initialPlan
    const hotWall: WallSun = {
      roomId: room.id,
      compass: 'W',
      lengthMeters: 4,
      directMinutes: 240,
      peakIntensity: 0.7,
      worstHour: 15,
      needsShade: true,
    }
    const coldCase = thermalProfile({
      walls: [hotWall],
      plan,
      room,
      ventilationScore: 0.9,
      insulationOn: true,
      latitude: BANGKOK.latitude,
    })
    const hotCase = thermalProfile({
      walls: [hotWall],
      plan,
      room,
      ventilationScore: 0.1,
      insulationOn: false,
      latitude: BANGKOK.latitude,
    })
    expect(coldCase.peakIndoorC).toBeLessThan(hotCase.peakIndoorC)
  })

  it('tropical latitude reads hotter than temperate', () => {
    expect(peakOutdoorC(13)).toBeGreaterThan(peakOutdoorC(45))
  })
})

describe('analyze (orchestrator)', () => {
  it('returns a result for every room in the plan', () => {
    const result = analyze({ plan: initialPlan, location: BANGKOK })
    expect(result.rooms.length).toBe(initialPlan.rooms.length)
    for (const room of result.rooms) {
      expect(room.room).toBeDefined()
      expect(room.walls.length).toBeGreaterThan(0)
    }
  })

  it('flags the initial plan as needing suggestions in Bangkok', () => {
    const result = analyze({ plan: initialPlan, location: BANGKOK })
    expect(result.suggestions.length).toBeGreaterThan(0)
    const ventSuggestions = result.suggestions.filter((s) => s.kind === 'ventilation')
    expect(ventSuggestions.length).toBeGreaterThan(0)
  })

  it('produces actionable suggestions with a place-window action when a wall is missing', () => {
    // Seal a room except for one wall — the opposite wall is the actionable target
    const sealedPlan: PlanState = {
      rooms: [{ id: 'r1', name: 'Test room', kind: 'bedroom', x: 20, y: 20, w: 40, h: 40 }],
      openings: [{ id: 'w1', type: 'window', x: 40, y: 20, rotation: 0 }], // only N wall
      furniture: [],
      systems: { solar: false, insulation: false, climate: false, lighting: false },
    }
    const result = analyze({ plan: sealedPlan, location: BANGKOK })
    const actionable = result.suggestions.find((s) => s.action?.type === 'place-window')
    expect(actionable).toBeDefined()
    expect(actionable!.action!.compass).toBe('S') // opposite of N
  })

  it('scores move when insulation is on', () => {
    const withInsulation = analyze({
      plan: { ...initialPlan, systems: { ...initialPlan.systems, insulation: true } },
      location: BANGKOK,
    })
    const withoutInsulation = analyze({
      plan: { ...initialPlan, systems: { ...initialPlan.systems, insulation: false } },
      location: BANGKOK,
    })
    const avgWith = avgPeak(withInsulation)
    const avgWithout = avgPeak(withoutInsulation)
    expect(avgWith).toBeLessThan(avgWithout)
  })

  it('includes a ventilation note and deltaC for every room', () => {
    const result = analyze({ plan: initialPlan, location: BANGKOK })
    for (const room of result.rooms) {
      expect(room.ventilationNote.length).toBeGreaterThan(5)
      expect(typeof room.deltaC).toBe('number')
      expect(room.deltaC).toBeGreaterThanOrEqual(0)
    }
  })
})

function avgPeak(result: ReturnType<typeof analyze>): number {
  return result.rooms.reduce((s, r) => s + r.peakIndoorC, 0) / result.rooms.length
}
