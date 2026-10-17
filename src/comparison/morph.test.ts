import { describe, expect, it } from 'vitest'
import { morphCoverage, morphPlan } from './morph'
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

  it('never invents a dimension only one end defines', () => {
    const withoutSize = plan({ furniture: [{ id: 'f1', kind: 'desk', x: 10, y: 10, rotated: false }] })
    const withSize = plan({ furniture: [{ id: 'f1', kind: 'desk', x: 20, y: 20, rotated: false, wM: 1.4 }] })
    // Interpolating a real measurement against an undefined one has no honest
    // answer, so the piece stays as drawn rather than gaining a fabricated size.
    expect(morphPlan(withoutSize, withSize, 0.5).furniture[0].wM).toBeUndefined()
    expect(morphPlan(withSize, withoutSize, 0.5).furniture[0].wM).toBeUndefined()
  })
})

describe('what a morph cannot carry is reported, not faked', () => {
  it('turns a piece at the midpoint instead of inventing a quarter rotation', () => {
    expect(morphPlan(a, b, 0.49).furniture[0].rotated).toBe(false)
    expect(morphPlan(a, b, 0.5).furniture[0].rotated).toBe(true)
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
})

describe('the morph carries the conditions it was compared under', () => {
  it('keeps the baseline site, systems and comparison so camera and sun hold', () => {
    const baseline = { ...a, site: { w: 12, h: 9, unit: 1 }, systems: { solar: true, insulation: false, climate: false, lighting: false } }
    const proposed = { ...b, site: { w: 30, h: 30, unit: 1 } }
    const morphed = morphPlan(baseline, proposed, 0.5)
    expect(morphed.site).toEqual({ w: 12, h: 9, unit: 1 })
    expect(morphed.systems.solar).toBe(true)
  })

  it('interpolates pencil walls and keeps the key optional when neither plan has any', () => {
    const withWalls = plan({ walls: [{ id: 'w1', x1: 0, y1: 0, x2: 10, y2: 10 }] })
    const otherWalls = plan({ walls: [{ id: 'w1', x1: 20, y1: 0, x2: 20, y2: 20 }] })
    expect(morphPlan(withWalls, otherWalls, 0.5).walls?.[0]).toMatchObject({ x1: 10, y1: 0, x2: 15, y2: 15 })
    expect(morphPlan(a, b, 0.5).walls).toBeUndefined()
  })
})