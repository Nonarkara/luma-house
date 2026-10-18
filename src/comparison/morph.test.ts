import { describe, expect, it } from 'vitest'
import { morphCoverage, morphPlan } from './morph'
import { furnitureRectFor, furnitureSpecFor, roomHeight } from '../plan'
import { openingDimensions } from '../openingGeometry'
import type { PlanState } from '../types'

const plan = (over: Partial<PlanState> = {}): PlanState => ({
  rooms: [],
  openings: [],
  furniture: [],
  systems: { solar: false, insulation: false, climate: false, lighting: false },
  ...over,
})

const a = plan({
  rooms: [{ id: 'r1', name: 'Living', kind: 'living', x: 10, y: 10, w: 40, h: 30, wallHeight: 3 }],
  openings: [{ id: 'o1', type: 'window', x: 30, y: 10, rotation: 0, widthM: 1.6, sillHeightM: 0.9 }],
  furniture: [{ id: 'f1', kind: 'sofa', x: 20, y: 20, rotated: false, wM: 2.2, dM: 0.9 }],
})
const b = plan({
  rooms: [{ id: 'r1', name: 'Living', kind: 'living', x: 30, y: 20, w: 50, h: 40, wallHeight: 3.5 }],
  openings: [{ id: 'o1', type: 'window', x: 50, y: 20, rotation: 0, widthM: 2.4, sillHeightM: 1.1 }],
  furniture: [{ id: 'f1', kind: 'sofa', x: 60, y: 50, rotated: true, wM: 2.6, dM: 1.0 }],
})

describe('morph endpoints are exactly the drawings that were pinned', () => {
  it('returns Plan A untouched at zero', () => {
    expect(morphPlan(a, b, 0).rooms).toEqual(a.rooms)
    expect(morphPlan(a, b, 0).furniture).toEqual(a.furniture)
    expect(morphPlan(a, b, 0).openings).toEqual(a.openings)
  })

  it('returns Plan B at one', () => {
    expect(morphPlan(a, b, 1).rooms).toEqual(b.rooms)
    expect(morphPlan(a, b, 1).furniture).toEqual(b.furniture)
    expect(morphPlan(a, b, 1).openings).toEqual(b.openings)
  })

  it('clamps a slider dragged past either end', () => {
    expect(morphPlan(a, b, -3).rooms).toEqual(a.rooms)
    expect(morphPlan(a, b, 9).rooms).toEqual(b.rooms)
  })

  it('preserves complete endpoint entities when dimensions and identities differ', () => {
    const measured = plan({
      rooms: [{ ...a.rooms[0], wallHeight: 4 }],
      openings: [{ ...a.openings[0], headHeightM: 3.1 }],
      furniture: [{ ...a.furniture[0], label: 'Custom desk', assetId: 'desk-a', wM: 3.2, dM: 1.6 }],
      walls: [{ id: 'w1', x1: 0, y1: 0, x2: 20, y2: 0 }],
    })
    const defaults = plan({
      rooms: [{ id: 'r1', name: 'Terrace', kind: 'terrace', x: 30, y: 20, w: 50, h: 40 }],
      openings: [{ id: 'o1', type: 'door', x: 10, y: 20, rotation: 90 }],
      furniture: [{ id: 'f1', kind: 'desk', x: 40, y: 40, rotated: true, label: 'Desk B', assetId: 'desk-b' }],
    })
    for (const [t, expected] of [[0, measured], [1, defaults]] as const) {
      const actual = morphPlan(measured, defaults, t)
      for (const key of ['rooms', 'openings', 'furniture', 'walls'] as const) {
        expect(actual[key]).toEqual(expected[key])
      }
    }
    expect(morphPlan(defaults, measured, 1).furniture).toEqual(measured.furniture)
  })
})

describe('the midpoint is a straight line between two measured numbers', () => {
  it('interpolates every continuous field', () => {
    const mid = morphPlan(a, b, 0.5)
    expect(mid.rooms[0]).toMatchObject({ x: 20, y: 15, w: 45, h: 35 })
    expect(mid.rooms[0].wallHeight).toBeCloseTo(3.25, 10)
    expect(mid.openings[0]).toMatchObject({ x: 40, y: 15 })
    expect(mid.openings[0].widthM).toBeCloseTo(2, 10)
    expect(mid.openings[0].sillHeightM).toBeCloseTo(1, 10)
    expect(mid.furniture[0]).toMatchObject({ x: 40, y: 35 })
    expect(mid.furniture[0].wM).toBeCloseTo(2.4, 10)
    expect(mid.furniture[0].dM).toBeCloseTo(0.95, 10)
  })

  it('is monotonic: every value sits between its two endpoints', () => {
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const f = morphPlan(a, b, t).furniture[0]
      expect(f.x).toBeGreaterThanOrEqual(Math.min(a.furniture[0].x, b.furniture[0].x))
      expect(f.x).toBeLessThanOrEqual(Math.max(a.furniture[0].x, b.furniture[0].x))
    }
  })

  it('interpolates a measured furniture dimension against its rendered default', () => {
    const withoutSize = plan({ furniture: [{ id: 'f1', kind: 'desk', x: 10, y: 10, rotated: false }] })
    const withSize = plan({ furniture: [{ id: 'f1', kind: 'desk', x: 20, y: 20, rotated: false, wM: 3.2, dM: 1.5 }] })
    // Omitted dimensions already draw the catalog footprint; resolve those same
    // numbers here so moving the slider cannot reset the measured endpoint.
    for (const [from, to] of [[withoutSize, withSize], [withSize, withoutSize]]) {
      const mid = morphPlan(from, to, 0.5).furniture[0]
      expect(furnitureSpecFor(mid).w).toBeCloseTo(2.3)
      expect(furnitureSpecFor(mid).d).toBeCloseTo(1.1)
    }
  })

  it('interpolates room and opening defaults including head-only window heights', () => {
    const defaults = plan({
      rooms: [{ ...a.rooms[0], wallHeight: undefined }],
      openings: [{ id: 'o1', type: 'window', x: 30, y: 10, rotation: 0 }],
    })
    const measured = plan({
      rooms: [{ ...a.rooms[0], wallHeight: 4 }],
      openings: [{ ...defaults.openings[0], widthM: 2.4, sillHeightM: 1.1, headHeightM: 3.1 }],
    })
    const mid = morphPlan(defaults, measured, 0.5)
    expect(roomHeight(mid.rooms[0])).toBeCloseTo(3.35)
    const dimensions = openingDimensions(mid.openings[0])
    expect(dimensions.width).toBeCloseTo(2)
    expect(dimensions.sill).toBeCloseTo(1)
    expect(dimensions.height).toBeCloseTo(1.6)
    expect(dimensions.head).toBeCloseTo(2.6)
    expect(mid.openings[0].headHeightM).toBeCloseTo(dimensions.head)
  })

  it('keeps the actual measured footprint when a sized piece turns', () => {
    const from = plan({ furniture: [{ id: 'f1', kind: 'desk', x: 10, y: 10, rotated: false, wM: 3.2, dM: 1.5 }] })
    const to = plan({ furniture: [{ ...from.furniture[0], rotated: true }] })
    const site = { w: 10, h: 10, unit: 1 }
    expect(furnitureRectFor(morphPlan(from, to, 0.49).furniture[0], site)).toMatchObject({ w: 32, h: 15 })
    expect(furnitureRectFor(morphPlan(from, to, 0.5).furniture[0], site)).toMatchObject({ w: 15, h: 32 })
  })
})

describe('what a morph cannot carry is reported, not faked', () => {
  it('turns a piece at the midpoint instead of inventing a quarter rotation', () => {
    expect(morphPlan(a, b, 0.49).furniture[0].rotated).toBe(false)
    expect(morphPlan(a, b, 0.5).furniture[0].rotated).toBe(true)
  })

  it('switches opening orientation and type exactly at the midpoint', () => {
    const other = plan({ openings: [{ ...a.openings[0], type: 'door', rotation: 90, x: 10, y: 30 }] })
    const before = morphPlan(a, other, 0.49).openings[0]
    const after = morphPlan(a, other, 0.5).openings[0]
    expect(before).toMatchObject({ type: 'window', rotation: 0 })
    expect(after).toMatchObject({ type: 'door', rotation: 90, x: 20, y: 20 })
    // Orientation also switches when the opening retains its type.
    const rotated = plan({ openings: [{ ...a.openings[0], rotation: 90 }] })
    expect(morphPlan(a, rotated, 0.5).openings[0].rotation).toBe(90)
  })

  it('switches room kind/name and furniture catalog identity at the midpoint', () => {
    const other = plan({
      rooms: [{ ...b.rooms[0], name: 'Terrace', kind: 'terrace' }],
      furniture: [{ ...b.furniture[0], label: 'Sofa B', assetId: 'sofa-b' }],
    })
    expect(morphPlan(a, other, 0.49).rooms[0]).toMatchObject({ kind: 'living', name: 'Living' })
    expect(morphPlan(a, other, 0.5).rooms[0]).toMatchObject({ kind: 'terrace', name: 'Terrace', x: 20 })
    expect(morphPlan(a, other, 0.49).furniture[0].assetId).toBeUndefined()
    expect(morphPlan(a, other, 0.5).furniture[0]).toMatchObject({ label: 'Sofa B', assetId: 'sofa-b', x: 40 })
    expect(morphCoverage(a, other)).toEqual({ continuous: 0, swapped: 3 })
  })

  it('swaps a piece that exists in only one plan, and does not duplicate it', () => {
    const onlyA = plan({ furniture: [{ id: 'a1', kind: 'bed', x: 10, y: 10, rotated: false }] })
    const onlyB = plan({ furniture: [{ id: 'b1', kind: 'bed', x: 10, y: 10, rotated: false }] })
    expect(morphPlan(onlyA, onlyB, 0.25).furniture.map((f) => f.id)).toEqual(['a1'])
    expect(morphPlan(onlyA, onlyB, 0.75).furniture.map((f) => f.id)).toEqual(['b1'])
    expect(morphPlan(onlyA, onlyB, 0.5).furniture).toHaveLength(1)
  })

  it('counts a re-typed piece as swapped, because a sofa is not half a bed', () => {
    const sofa = plan({ furniture: [{ id: 'f1', kind: 'sofa', x: 10, y: 10, rotated: false }] })
    const bed = plan({ furniture: [{ id: 'f1', kind: 'bed', x: 40, y: 40, rotated: false }] })
    const coverage = morphCoverage(sofa, bed)
    expect(coverage.continuous).toBe(0)
    // One piece becomes a different piece: that is a single swap, not two.
    expect(coverage.swapped).toBe(1)
    // It still moves; what it is stays Plan A's answer until the midpoint.
    expect(morphPlan(sofa, bed, 0.25).furniture[0].kind).toBe('sofa')
    expect(morphPlan(sofa, bed, 0.75).furniture[0].kind).toBe('bed')
  })

  it('counts identical plans as fully continuous', () => {
    expect(morphCoverage(a, a)).toEqual({ continuous: 3, swapped: 0 })
  })

  it('counts one added piece as a single swap, not two', () => {
    const grown = { ...b, furniture: [...b.furniture, { id: 'f2', kind: 'bed' as const, x: 5, y: 5, rotated: false }] }
    const coverage = morphCoverage(a, grown)
    expect(coverage.continuous).toBe(3)
    expect(coverage.swapped).toBe(1)
  })

  it('counts removed and added IDs separately even when collection lengths match', () => {
    const changed = plan({
      furniture: [{ ...a.furniture[0], id: 'new' }],
    })
    const before = plan({ furniture: a.furniture })
    expect(morphCoverage(before, changed)).toEqual({ continuous: 0, swapped: 2 })
    expect(morphCoverage(changed, before)).toEqual({ continuous: 0, swapped: 2 })
    const grown = plan({ furniture: [...changed.furniture, { ...a.furniture[0], id: 'another' }] })
    expect(morphCoverage(before, grown)).toEqual({ continuous: 0, swapped: 3 })
  })
})

describe('the morph carries the conditions it was compared under', () => {
  it('keeps the baseline site, systems and comparison so camera and sun hold', () => {
    const baseline = { ...a, site: { w: 12, h: 9, unit: 1 }, systems: { solar: true, insulation: false, climate: false, lighting: false } }
    const proposed = { ...b, site: { w: 30, h: 30, unit: 1 } }
    for (const t of [0, 0.5, 1]) {
      const morphed = morphPlan(baseline, proposed, t)
      expect(morphed.site).toEqual({ w: 12, h: 9, unit: 1 })
      expect(morphed.systems.solar).toBe(true)
    }
  })

  it('interpolates pencil walls and keeps the key optional when neither plan has any', () => {
    const withWalls = plan({ walls: [{ id: 'w1', x1: 0, y1: 0, x2: 10, y2: 10 }] })
    const otherWalls = plan({ walls: [{ id: 'w1', x1: 20, y1: 0, x2: 20, y2: 20 }] })
    expect(morphPlan(withWalls, otherWalls, 0.5).walls?.[0]).toMatchObject({ x1: 10, y1: 0, x2: 15, y2: 15 })
    expect(morphPlan(a, b, 0.5).walls).toBeUndefined()
  })
})
