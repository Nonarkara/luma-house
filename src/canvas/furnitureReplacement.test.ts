import { describe, expect, it } from 'vitest'
import { furnitureRectFor } from '../plan'
import type { Furniture, PlanState } from '../types'
import { prepareFurnitureReplacement, type FurnitureChoice } from './furnitureReplacement'

const original: Furniture = { id: 'kept-id', kind: 'sofa', label: 'Old sofa', assetId: 'glam-velvet-sofa', wM: 2.19, dM: 1.02, x: 35, y: 35, rotated: false }
const plan: PlanState = { site: { w: 10, h: 8, unit: 1 }, rooms: [{ id: 'r', kind: 'living', name: 'Living', x: 10, y: 10, w: 80, h: 80 }], furniture: [original], openings: [], systems: { solar: true, insulation: false, climate: false, lighting: true } }
const choice: FurnitureChoice = { kind: 'sofa', label: 'New sofa', wM: 2.5, dM: 1.2, assetId: 'wood-leather-sofa' }

describe('in-place product replacement', () => {
  it.each([false, true])('keeps identity, orientation and physical centre (rotated=%s)', rotated => {
    const source = { ...plan, furniture: [{ ...original, rotated }] }
    const before = furnitureRectFor(source.furniture[0], source.site!)
    const snapshot = JSON.stringify(source)
    const result = prepareFurnitureReplacement(source, original.id, choice)
    expect(result.item).toMatchObject({ id: original.id, rotated, ...choice })
    const after = furnitureRectFor(result.item!, source.site!)
    expect(after.x + after.w / 2).toBeCloseTo(before.x + before.w / 2)
    expect(after.y + after.h / 2).toBeCloseTo(before.y + before.h / 2)
    expect(JSON.stringify(source)).toBe(snapshot)
  })
  it('clears the previous product mesh when choosing a schematic piece', () => {
    const result = prepareFurnitureReplacement(plan, original.id, { kind: 'desk', label: 'Desk', wM: 1.6, dM: .8 })
    expect(result.item).not.toHaveProperty('assetId')
    expect(result.item).toMatchObject({ kind: 'desk', wM: 1.6, dM: .8 })
  })
  it('refuses a wall crossing rather than relocating, rotating or shrinking the choice', () => {
    const narrow = { ...plan, rooms: [{ ...plan.rooms[0], x: 35, w: 25 }] }
    expect(prepareFurnitureReplacement(narrow, original.id, choice).error).toMatch(/wall/)
    expect(prepareFurnitureReplacement({ ...plan, rooms: [] }, original.id, choice).item).toBeUndefined()
  })
  it('refuses a collision with a different furniture identity', () => {
    const occupied = { ...plan, furniture: [original, { ...original, id: 'other', x: 34, y: 34 }] }
    expect(prepareFurnitureReplacement(occupied, original.id, choice).error).toMatch(/overlaps/)
  })
  it('refuses an obstructed door even when the room and furniture clear', () => {
    const withDoor = { ...plan, openings: [{ id: 'door', type: 'door' as const, x: 45, y: 35, rotation: 0 as const, widthM: 1 }] }
    expect(prepareFurnitureReplacement(withDoor, original.id, choice).error).toMatch(/door swing/)
  })
  it('refuses a stale selection and non-finite or non-positive dimensions without changing the plan', () => {
    const snapshot = JSON.stringify(plan)
    expect(prepareFurnitureReplacement(plan, 'removed', choice).error).toMatch(/no longer/)
    for (const wM of [NaN, Infinity, 0, -1, 101]) expect(prepareFurnitureReplacement(plan, original.id, { ...choice, wM }).item).toBeUndefined()
    expect(JSON.stringify(plan)).toBe(snapshot)
  })
})
