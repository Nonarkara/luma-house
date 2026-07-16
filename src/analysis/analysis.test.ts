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
})

describe('wallSunForDay', () => {
  it('hits the south wall hardest in Bangkok at summer solstice', () => {
    const south = wallSunForDay(BANGKOK.latitude, 172, 'S')
    const north = wallSunForDay(BANGKOK.latitude, 172, 'N')
    expect(south.directMinutes).toBeGreaterThan(north.directMinutes)
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