import { describe, expect, it } from 'vitest'
import { furnitureDoorConflicts, furnitureRectFor } from '../plan'
import type { Furniture, PlanState } from '../types'
import { findFurniturePlacement, furniturePlacementIssues, moveFurnitureTo, rotateFurnitureAtCentre } from './furniturePlacement'

const item: Furniture = { id: 'sofa', kind: 'sofa', assetId: 'glam-velvet-sofa', label: 'Velvet sofa', wM: 2.19, dM: 1.02, x: 30, y: 30, rotated: false }
const site = { w: 10, h: 8, unit: 1 }
const plan: PlanState = { site, rooms: [{ id: 'room', name: 'Drawn room', kind: 'studio', x: 20, y: 20, w: 50, h: 60 }], furniture: [], openings: [], systems: { solar: false, insulation: false, climate: false, lighting: false } }

describe('furnishing a drawn room', () => {
  it('places the exact measured asset in the selected room, clear of its walls', () => {
    const placed = findFurniturePlacement(plan, item, 'room')!
    expect(placed.item).toMatchObject({ assetId: item.assetId, wM: 2.19, dM: 1.02, rotated: false })
    expect(furniturePlacementIssues({ ...plan, furniture: [placed.item] }, placed.item)).toEqual([])
    const rect = furnitureRectFor(placed.item, site)
    expect(rect.x).toBeGreaterThan(20)
    expect(rect.x + rect.w).toBeLessThan(70)
  })

  it('never spills a selected-room addition into another room', () => {
    const small = { ...plan.rooms[0], id: 'tiny', w: 5, h: 5 }
    expect(findFurniturePlacement({ ...plan, rooms: [small, plan.rooms[0]] }, item, 'tiny')).toBeNull()
    expect(findFurniturePlacement(plan, item, 'missing')).toBeNull()
    expect(findFurniturePlacement({ ...plan, rooms: [] }, item)).toBeNull()
  })

  it('rotates a piece that only fits across the other axis without resizing it', () => {
    const narrow = { ...plan, rooms: [{ ...plan.rooms[0], w: 16, h: 40 }] }
    const placed = findFurniturePlacement(narrow, item)!
    expect(placed.item).toMatchObject({ wM: item.wM, dM: item.dM, rotated: true })
  })

  it('a duplicate occupies fresh space and clears the same door buffer as the editor', () => {
    const original = findFurniturePlacement(plan, item)!.item
    const withDoor = { ...plan, furniture: [original], openings: [{ id: 'door', type: 'door' as const, rotation: 0 as const, x: 40, y: 20 }] }
    const copy = findFurniturePlacement(withDoor, { ...original, id: 'copy' })!.item
    expect(furniturePlacementIssues({ ...withDoor, furniture: [original, copy] }, copy)).toEqual([])
    expect(furnitureDoorConflicts([copy], withDoor.openings, site).size).toBe(0)
    expect(copy).toMatchObject({ label: item.label, assetId: item.assetId, wM: 2.19, dM: 1.02 })
    expect(copy.x === original.x && copy.y === original.y).toBe(false)
  })

  it('does not shrink, stack or append an item when the room is full', () => {
    const occupied = { ...item, id: 'full', x: 20, y: 20, wM: 5, dM: 4.8 }
    expect(findFurniturePlacement({ ...plan, furniture: [occupied] }, item)).toBeNull()
    expect(plan.furniture).toEqual([])
  })

  it('keeps centre during rotation and clamps movement by the rotated footprint', () => {
    const before = furnitureRectFor(item, site), rotated = rotateFurnitureAtCentre(item, site)!
    const after = furnitureRectFor(rotated, site)
    expect(rotated.x + after.w / 2).toBeCloseTo(item.x + before.w / 2)
    expect(rotated.y + after.h / 2).toBeCloseTo(item.y + before.h / 2)
    const moved = moveFurnitureTo(rotated, 500, -500, site)!
    expect(moved.x + after.w).toBeCloseTo(100)
    expect(moved.y).toBe(0)
    expect(moveFurnitureTo(item, NaN, 20, site)).toBeNull()
    expect(moveFurnitureTo({ ...item, wM: 30 }, 0, 0, site)).toBeNull()
    expect(rotateFurnitureAtCentre({ ...item, dM: 30 }, site)).toBeNull()
  })

  it('reports manual overlaps, room crossings and door obstruction honestly', () => {
    const bad = { ...item, x: 15, y: 19 }
    expect(furniturePlacementIssues({ ...plan, furniture: [{ ...bad, id: 'other' }], openings: [{ id: 'door', type: 'door', rotation: 0, x: 20, y: 20 }] }, bad)).toEqual(['outside room bounds', 'overlaps furniture', 'blocks a door swing'])
  })
})
