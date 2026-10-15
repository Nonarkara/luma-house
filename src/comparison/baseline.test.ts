import { describe, expect, it } from 'vitest'
import { completeHousePlan } from '../mockups/completeHouse'
import { starterLocations } from '../location/locations'
import { decodePlanFromHash, encodePlanToHash, sanitizePlan } from '../sharePlan'
import { physicalGeometryKey } from '../study/geometry'
import type { StudyScene } from '../study/types'
import { pinBaseline, restoreBaseline } from './baseline'

const pinnedAt = '2026-10-15T06:00:00.000Z'
const scene: StudyScene = {
  id: 'saved-camera', name: 'Before changes', capturedAt: pinnedAt, geometryKey: 'original',
  location: starterLocations[1], year: 2026, day: 288, hour: 9,
  camera: { projection: 'orthographic', position: [10, 10, 10], target: [0, 0, 0], up: [0, 1, 0], zoom: 1, fov: 45, fieldHeight: 20 },
  settings: { preset: 'axonometric', style: 'architectural', sectionHeight: 1.4, roofStyle: 'flat', showRoof: false, shadows: true, sunRays: true, airPaths: false },
}
const drawing = { ...completeHousePlan, location: starterLocations[1], studyScenes: [scene] }

describe('durable A/B drawing baseline', () => {
  it('pins a complete nonrecursive snapshot while retaining geometry references and cache identity', () => {
    const pinned = pinBaseline(drawing, 'Before moving the desk', pinnedAt)
    expect(pinned.comparison).toEqual({ baselinePlan: drawing, baselineName: 'Before moving the desk', pinnedAt })
    expect(pinned.rooms).toBe(drawing.rooms)
    expect(pinned.openings).toBe(drawing.openings)
    expect(pinned.furniture).toBe(drawing.furniture)
    expect(pinned.systems).toBe(drawing.systems)
    expect(pinned.studyScenes).toBe(drawing.studyScenes)
    expect(physicalGeometryKey(pinned)).toBe(physicalGeometryKey(drawing))
    expect(drawing).not.toHaveProperty('comparison')
    expect(pinned.comparison?.baselinePlan).not.toHaveProperty('comparison')
  })

  it('promotes successive drawings without retaining nested alternatives or growing the payload', () => {
    let plan = pinBaseline(drawing, 'Plan A', pinnedAt)
    const firstLength = JSON.stringify(plan).length
    for (let i = 0; i < 100; i++) plan = pinBaseline(plan, 'Plan A', pinnedAt)
    expect(plan.comparison?.baselinePlan).not.toHaveProperty('comparison')
    expect(JSON.stringify(plan).length).toBe(firstLength)
    const changed = { ...plan, rooms: plan.rooms.map((room, i) => i === 0 ? { ...room, wallHeight: 4 } : room) }
    expect(pinBaseline(changed, 'New A', pinnedAt).comparison?.baselinePlan.rooms).toEqual(changed.rooms)
  })

  it('restores the whole original drawing while keeping the same comparison and the proposed drawing intact for undo', () => {
    const pinned = pinBaseline(drawing, 'Plan A', pinnedAt)
    const proposed = { ...pinned, site: { w: 20, h: 15, unit: 0.5 }, location: starterLocations[0],
      rooms: pinned.rooms.map((room, i) => i === 0 ? { ...room, wallHeight: 4 } : room),
      furniture: pinned.furniture.map((piece, i) => i === 0 ? { ...piece, x: piece.x + 1 } : piece),
      systems: { ...pinned.systems, insulation: !pinned.systems.insulation } }
    const before = JSON.stringify(proposed)
    const restored = restoreBaseline(proposed)
    expect(restored).toEqual({ ...drawing, comparison: pinned.comparison })
    expect(restored.comparison).toBe(proposed.comparison)
    expect(JSON.stringify(proposed)).toBe(before)
    expect(restoreBaseline(drawing)).toBe(drawing)
  })

  it('round-trips both drawings through storage, a shared hash and an exported project plan', () => {
    const pinned = pinBaseline(drawing, 'Before moving the desk', pinnedAt)
    const proposed = { ...pinned, rooms: pinned.rooms.map((room, i) => i === 0 ? { ...room, name: 'Changed room' } : room) }
    const saved = sanitizePlan(JSON.parse(JSON.stringify(proposed)))
    const shared = decodePlanFromHash('#plan=' + encodePlanToHash(proposed))
    const exported = JSON.parse(JSON.stringify({ project: 'A/B study', plan: proposed }))
    const imported = sanitizePlan(exported.plan)
    for (const result of [saved, shared, imported]) {
      expect(result).toEqual(proposed)
      expect(result?.rooms).not.toEqual(result?.comparison?.baselinePlan.rooms)
      expect(result?.comparison?.baselinePlan.location).toEqual(drawing.location)
      expect(result?.comparison?.baselinePlan.studyScenes).toEqual([scene])
    }
  })

  it('ignores comparison fields inside a baseline without visiting even a cyclic nested comparison', () => {
    const comparison = { baselinePlan: { ...drawing, comparison: {} as unknown }, baselineName: 'Plan A', pinnedAt }
    comparison.baselinePlan.comparison = comparison
    const result = sanitizePlan({ ...drawing, comparison })
    expect(result?.comparison?.baselinePlan).toEqual(drawing)
    expect(result?.comparison?.baselinePlan).not.toHaveProperty('comparison')
    expect(() => JSON.stringify(result)).not.toThrow()
  })

  it.each([
    null,
    { baselinePlan: drawing, baselineName: '', pinnedAt },
    { baselinePlan: drawing, baselineName: ' '.repeat(65), pinnedAt },
    { baselinePlan: drawing, baselineName: 'Plan A', pinnedAt: 'not a timestamp' },
    { baselinePlan: drawing, baselineName: 'Plan A', pinnedAt: 'x'.repeat(33) },
    { baselinePlan: { rooms: 'invalid' }, baselineName: 'Plan A', pinnedAt },
    { baselinePlan: { ...drawing, furniture: Array.from({ length: 1001 }, (_, i) => ({ id: String(i) })) }, baselineName: 'Plan A', pinnedAt },
  ])('drops malformed or oversized comparison metadata without losing the current drawing: %j', comparison => {
    expect(sanitizePlan({ ...drawing, comparison })).toEqual(drawing)
  })

  it('bounds the baseline with the existing duplicate-id and collection validation, and leaves legacy files unchanged', () => {
    const comparison = { baselinePlan: { ...drawing, rooms: [drawing.rooms[0], drawing.rooms[0]] }, baselineName: 'Plan A', pinnedAt }
    expect(sanitizePlan({ ...drawing, comparison })).toEqual(drawing)
    expect(sanitizePlan(drawing)).toEqual(drawing)
    expect(sanitizePlan(pinBaseline(drawing, '  Named A  ', pinnedAt))?.comparison?.baselineName).toBe('Named A')
  })
})
