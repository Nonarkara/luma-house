import { describe, expect, it } from 'vitest'
import { openingDimensions } from '../openingGeometry'
import { calculateBudget, initialPlan, siteOf, totalAreaFor } from '../plan'
import type { PlanState } from '../types'
import { buildDrawingSheet } from './sheet'
import { DRAWING_STYLES, drawingStyleById } from './styles'

const plan: PlanState = {
  site: { w: 10, h: 8, unit: 1 },
  rooms: [
    { id: 'a', name: 'Living', kind: 'living', x: 10, y: 10, w: 40, h: 50, wallHeight: 3 },
    { id: 'b', name: 'Bed', kind: 'bedroom', x: 50, y: 10, w: 30, h: 50, wallHeight: 2.5 },
  ],
  openings: [
    { id: 'win', type: 'window', x: 30, y: 10, rotation: 0, widthM: 2, sillHeightM: 0.8, heightM: 1.2 },
    { id: 'door', type: 'door', x: 50, y: 35, rotation: 90, widthM: 0.9 },
  ],
  furniture: [],
  systems: { solar: false, insulation: false, climate: false, lighting: false },
}

describe('buildDrawingSheet', () => {
  it('measures rooms, the section, and the elevation from the plan', () => {
    const sheet = buildDrawingSheet(plan)
    const window = openingDimensions(plan.openings[0])

    expect(sheet.totals.area).toBe(28)
    expect(sheet.rooms.map((room) => [room.id, room.x, room.w, room.height, room.area])).toEqual([
      ['a', 1, 4, 3, 16],
      ['b', 5, 3, 2.5, 12],
    ])
    expect(sheet.extents).toEqual({ width: 7, depth: 4 })
    expect(sheet.walls.filter((wall) => !wall.exterior)).toHaveLength(1)
    expect(sheet.walls.every((wall) => wall.thickness === 0.15)).toBe(true)

    expect(sheet.section?.axis).toBe('ew')
    expect(sheet.section?.at).toBeCloseTo(2.8)
    expect(sheet.section?.looking).toBe('north')
    expect(sheet.section?.slices.map((slice) => [slice.roomId, slice.height])).toEqual([
      ['a', 3],
      ['b', 2.5],
    ])

    const beyond = sheet.section?.slices.flatMap((slice) => slice.voids).filter((item) => item.kind === 'beyond')
    expect(beyond).toEqual([
      expect.objectContaining({ openingId: 'win', u: 3, width: window.width, sill: window.sill, head: window.head, kind: 'beyond' }),
    ])
    const cuts = sheet.section?.slices.flatMap((slice) => slice.voids).filter((item) => item.kind === 'cut')
    expect(cuts).toHaveLength(2)
    expect(cuts?.every((item) => item.openingId === 'door' && item.width === 0.9 && item.sill === 0 && item.head === 2.1)).toBe(true)

    expect(sheet.elevation?.face).toBe('North')
    expect(sheet.elevation?.bays.flatMap((bay) => bay.openings).map((item) => item.openingId)).toEqual(['win'])
  })

  it('follows a moved room and a changed ceiling instead of a fixed picture', () => {
    const moved = buildDrawingSheet({
      ...plan,
      rooms: plan.rooms.map((room) => (room.id === 'a' ? { ...room, x: 0, wallHeight: 4 } : room)),
    })
    expect(moved.rooms.find((room) => room.id === 'a')).toMatchObject({ x: 0, height: 4 })
    expect(moved.section?.slices.find((slice) => slice.roomId === 'a')?.height).toBe(4)
    expect(moved).toEqual(buildDrawingSheet({
      ...plan,
      rooms: plan.rooms.map((room) => (room.id === 'a' ? { ...room, x: 0, wallHeight: 4 } : room)),
    }))
  })

  it('swings the shared door into the larger room and drops openings that touch nothing', () => {
    const sheet = buildDrawingSheet({
      ...plan,
      openings: [...plan.openings, { id: 'lost', type: 'window', x: 1, y: 1, rotation: 0 }],
    })
    const door = sheet.openings.find((item) => item.id === 'door')
    expect(door?.roomId).toBe('a')
    expect(door?.swing).toMatchObject({ radius: 0.9, openX: 4.1 })
    expect(door && door.swing && door.swing.openX > 1 && door.swing.openX < 5).toBe(true)
    expect(sheet.openings.some((item) => item.id === 'lost')).toBe(false)
  })

  it('uses the terrace slab and the same area total as the quantity sheet', () => {
    const terrace = buildDrawingSheet({
      ...plan,
      rooms: [{ id: 't', name: 'Terrace', kind: 'terrace', x: 0, y: 0, w: 100, h: 100 }],
      openings: [],
    })
    expect(terrace.rooms[0].height).toBe(0.12)
    expect(terrace.totals.area).toBe(80)

    const sample = buildDrawingSheet(initialPlan)
    expect(sample.totals.area).toBeCloseTo(totalAreaFor(initialPlan.rooms, siteOf(initialPlan)))
    expect(sample.section?.slices.length).toBeGreaterThan(0)
    expect(sample.elevation?.bays.length).toBeGreaterThan(0)
  })

  it('keeps one geometry for every graphic style and lets the style change the estimate', () => {
    expect(DRAWING_STYLES.map((style) => style.id)).toEqual([
      'minimalist',
      'classical',
      'fancy',
      'postmodern',
      'high-tech',
      'vernacular',
    ])
    expect(new Set(DRAWING_STYLES.map((style) => style.paper)).size).toBe(DRAWING_STYLES.length)
    const bare = calculateBudget(plan, '').total
    expect(calculateBudget(plan, drawingStyleById('minimalist').keywords).total).toBeLessThan(bare)
    expect(calculateBudget(plan, drawingStyleById('vernacular').keywords).total).toBeLessThan(bare)
    expect(calculateBudget(plan, drawingStyleById('classical').keywords).total).toBeGreaterThan(bare)
    expect(calculateBudget(plan, drawingStyleById('fancy').keywords).total).toBeGreaterThan(bare)
    expect(calculateBudget(plan, drawingStyleById('high-tech').keywords).total).toBeGreaterThan(bare)
    expect(calculateBudget(plan, drawingStyleById('postmodern').keywords).total).toBeGreaterThan(bare)
    expect(drawingStyleById('minimalist').spatial.wall).not.toBe(drawingStyleById('high-tech').spatial.wall)
  })
})
