import { furnitureDoorConflicts } from './plan'
import { describe, expect, it } from 'vitest'
import { decodePlanFromHash, encodePlanToHash, sanitizePlan } from './sharePlan'
import { DEFAULT_ASSEMBLIES } from './assemblies/resolve'
import { synthesizeLayout } from './concept/layoutSynthesizer'
import { egressRoutes } from './analysis/egress'
import { roomsForOpening } from './analysis/walls'
import { simulateEnergy } from './analysis/energySimulation'
import type { PlanState } from './types'

const room = { id: 'room', name: 'Room', kind: 'living' as const, x: 0, y: 0, w: 50, h: 50, wallHeight: 3 }
const plan: PlanState = {
  rooms: [room], furniture: [], site: { w: 10, h: 10, unit: 1 },
  systems: { solar: false, insulation: false, climate: false, lighting: false },
  assemblies: { ...DEFAULT_ASSEMBLIES, glazingSHGC: 0.42 },
  openings: [{ id: 'win', type: 'window', x: 25, y: 0, rotation: 0, widthM: 1.8, heightM: 1.3, sillHeightM: 0.8, headHeightM: 2.1, shgc: 0.4, vlt: 0.6, operableFraction: 0.25 }],
}

describe('physical model integrity', () => {
  it('round-trips all physical inputs through saving and sharing', () => {
    expect(sanitizePlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan)
    expect(decodePlanFromHash(`#plan=${encodePlanToHash(plan)}`)).toEqual(plan)
  })
  it('does not attach a rotated opening or a width that crosses a corner', () => {
    expect(roomsForOpening(plan, { ...plan.openings[0], rotation: 90 })).toEqual([])
    expect(roomsForOpening(plan, { ...plan.openings[0], x: 2 })).toEqual([])
  })
  for (const style of ['courtyard', 'compact', 'linear', 'l-shaped'] as const) {
    for (const targetAreaM2 of [20, 40, 60, 80, 150, 1000]) {
      it(`${style} produces ${targetAreaM2} m² and connected rooms with attached openings`, () => {
        const generated = synthesizeLayout({ style, targetAreaM2, includeStudy: true, includeTerrace: true })
        const area = generated.rooms.filter(r => r.kind !== 'terrace').reduce((a, r) => a + r.w * r.h / 10000 * generated.site!.w * generated.site!.h, 0)
        expect(area).toBeCloseTo(targetAreaM2, 6)
        for (const opening of generated.openings) {
          expect(roomsForOpening(generated, opening).length, opening.id).toBeGreaterThan(0)
        }
        expect(furnitureDoorConflicts(generated.furniture, generated.openings, generated.site).size).toBe(0)
        expect(egressRoutes(generated).filter(r => r.room.kind !== 'terrace').every(r => r.connected)).toBe(true)
      })
    }
  }
  it('keeps the 60 m² L-shaped UI preset clear of door swings', () => {
    const generated = synthesizeLayout({ style: 'l-shaped', targetAreaM2: 60 })
    expect(generated.furniture.some(item => item.kind === 'bed')).toBe(true)
    expect(furnitureDoorConflicts(generated.furniture, generated.openings, generated.site).size).toBe(0)
  })
  it('does not assign a grade or payback without a real simulation', () => {
    for (const input of [plan, { ...plan, rooms: [], openings: [] }]) {
      const result = simulateEnergy(input)
      expect(result.energyRating).toBeNull()
      expect(result.carbonNeutralityPaybackYears).toBeNull()
    }
  })
})
