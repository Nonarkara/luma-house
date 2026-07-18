import { describe, expect, it } from 'vitest'
import { calculateBudget, DEFAULT_WALL_HEIGHT, estimateEmbodiedCarbon, estimateEnergySavings, furnitureDoorConflicts, furnitureRect, initialPlan, locations, roomArea, roomHeight, roomOverlaps, solarPosition, sunPatches, sunVector, totalArea } from './plan'
import type { Opening, PlanState, Room } from './types'

describe('plan calculations', () => {
  it('converts percentage room dimensions into square meters', () => {
    expect(roomArea({ id: 'a', name: 'Room', kind: 'living', x: 0, y: 0, w: 50, h: 50 })).toBe(35)
  })

  it('totals rooms and creates a positive construction estimate', () => {
    const area = totalArea(initialPlan.rooms)
    const budget = calculateBudget(initialPlan)
    expect(area).toBeCloseTo(96.572)
    expect(budget.total).toBeGreaterThan(budget.subtotal)
  })

  it('places the Bangkok sun above the horizon at noon', () => {
    const sun = solarPosition(13.7563, 196, 12)
    expect(sun.altitude).toBeGreaterThan(60)
  })

  it('rewards selected intelligent systems without exceeding the cap', () => {
    expect(estimateEnergySavings({ solar: true, insulation: true, climate: true, lighting: true })).toBe(64)
  })

  it('renders furniture at its real-world footprint', () => {
    const rect = furnitureRect({ id: 'f', kind: 'bed', x: 10, y: 10, rotated: false })
    expect(rect.w).toBeCloseTo((2.0 / 14) * 100)
    expect(rect.h).toBeCloseTo((1.8 / 10) * 100)
    const rotated = furnitureRect({ id: 'f', kind: 'bed', x: 10, y: 10, rotated: true })
    expect(rotated.w).toBeCloseTo((1.8 / 14) * 100)
  })

  it('flags furniture inside a door swing and clears distant furniture', () => {
    const door: Opening = { id: 'd', type: 'door', x: 50, y: 50, rotation: 0 }
    const window: Opening = { id: 'w', type: 'window', x: 6, y: 6, rotation: 0 }
    const conflicts = furnitureDoorConflicts(
      [
        { id: 'near', kind: 'bed', x: 50, y: 51, rotated: false },
        { id: 'far', kind: 'bed', x: 5, y: 5, rotated: false },
      ],
      [door, window],
    )
    expect(conflicts.has('near')).toBe(true)
    expect(conflicts.has('far')).toBe(false)
  })

  it('returns no sun patches when the sun is at or below the horizon', () => {
    expect(sunPatches(initialPlan, 180, 0)).toEqual([])
    expect(sunPatches(initialPlan, 180, 2)).toEqual([])
  })

  const westWindowPlan: PlanState = {
    rooms: [{ id: 'room', name: 'Room', kind: 'living', x: 50, y: 20, w: 40, h: 60 }],
    openings: [{ id: 'w', type: 'window', x: 50, y: 50, rotation: 90 }],
    furniture: [],
    systems: { solar: false, insulation: false, climate: false, lighting: false },
  }

  it('casts a west-facing sun patch into the room it lights', () => {
    const patches = sunPatches(westWindowPlan, 270, 30)
    expect(patches).toHaveLength(1)
    const [patch] = patches
    const depth = 2.4 / Math.tan((30 * Math.PI) / 180)
    expect(patch.roomId).toBe('room')
    expect(patch.polygon.every((point) => point.x >= 50 - 0.01)).toBe(true)
    const maxX = Math.max(...patch.polygon.map((point) => point.x))
    expect(maxX).toBeGreaterThan(50)
    expect(maxX).toBeCloseTo(50 + (depth / 14) * 100, 0)
    expect(patch.areaM2).toBeCloseTo(1.6 * depth, 1)
  })

  it('clamps sun patch depth between 0.3 m and 6 m', () => {
    const [steep] = sunPatches(westWindowPlan, 270, 85)
    const steepMaxX = Math.max(...steep.polygon.map((point) => point.x))
    expect(steepMaxX - 50).toBeCloseTo((0.3 / 14) * 100, 1)

    const [low] = sunPatches(westWindowPlan, 270, 5)
    const lowMaxX = Math.max(...low.polygon.map((point) => point.x))
    expect(lowMaxX - 50).toBeCloseTo((6 / 14) * 100, 1)
  })

  it('drops a sun patch whose light falls outside every room', () => {
    expect(sunPatches(westWindowPlan, 90, 30)).toEqual([])
  })

  it('adds Quito and Anchorage to the location list', () => {
    expect(locations.Quito.latitude).toBeLessThan(0)
    expect(locations.Anchorage.latitude).toBeGreaterThan(61)
  })

  it('scales budget from style keywords without changing base area', () => {
    const base = calculateBudget(initialPlan)
    const luxury = calculateBudget(initialPlan, 'luxury marble premium')
    const minimal = calculateBudget(initialPlan, 'minimalist cozy simple')
    expect(luxury.area).toBe(base.area)
    expect(luxury.total).toBeGreaterThan(base.total)
    expect(minimal.total).toBeLessThan(base.total)
  })

  const rect = (id: string, x: number, y: number, w: number, h: number): Room => ({ id, name: id, kind: 'studio', x, y, w, h })

  it('flags overlapping rooms and clears clean layouts', () => {
    const clean = roomOverlaps([rect('a', 0, 0, 30, 30), rect('b', 30, 0, 30, 30)])
    expect(clean.size).toBe(0)
    const clashing = roomOverlaps([rect('a', 0, 0, 30, 30), rect('b', 20, 10, 30, 30), rect('c', 60, 60, 20, 20)])
    expect(clashing.has('a')).toBe(true)
    expect(clashing.has('b')).toBe(true)
    expect(clashing.has('c')).toBe(false)
  })

  it('defaults room wall height and respects an explicit override', () => {
    const bare: Room = { id: 'a', name: 'Room', kind: 'living', x: 0, y: 0, w: 30, h: 30 }
    expect(roomHeight(bare)).toBe(DEFAULT_WALL_HEIGHT)
    const tall: Room = { ...bare, wallHeight: 3.2 }
    expect(roomHeight(tall)).toBe(3.2)
  })

  it('points the sun vector toward east, south, and straight up', () => {
    const east = sunVector(90, 0)
    expect(east.x).toBeCloseTo(1)
    expect(east.y).toBeCloseTo(0)
    expect(east.z).toBeCloseTo(0)

    const south = sunVector(180, 0)
    expect(south.x).toBeCloseTo(0)
    expect(south.y).toBeCloseTo(0)
    expect(south.z).toBeCloseTo(1)

    const overhead = sunVector(0, 90)
    expect(overhead.y).toBeCloseTo(1)
  })

  it('estimates embodied carbon with transparent per-line factors', () => {
    const carbon = estimateEmbodiedCarbon(initialPlan)
    expect(carbon.totalKg).toBeGreaterThan(0)
    expect(carbon.kgPerM2).toBeCloseTo(carbon.totalKg / totalArea(initialPlan.rooms), 1)
    expect(carbon.lines.length).toBeGreaterThanOrEqual(5)
    const summed = carbon.lines.reduce((sum, line) => sum + line.kgCO2e, 0)
    expect(carbon.totalKg).toBeCloseTo(summed, 6)
    // Systems add real lines, not hidden multipliers.
    const bare = estimateEmbodiedCarbon({ ...initialPlan, systems: { solar: false, insulation: false, climate: false, lighting: false } })
    expect(bare.totalKg).toBeLessThan(carbon.totalKg)
  })
})
