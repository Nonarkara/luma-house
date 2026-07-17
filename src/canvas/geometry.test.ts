import { describe, expect, it } from 'vitest'
import { clampRoom, moveRoom, resizeRoom, scaleRoomFromCenter, snapOpeningToWall, strokeToRoomRect } from './geometry'
import type { Opening, Room } from '../types'

const base: Room = { id: 'r1', name: 'Test', kind: 'studio', x: 20, y: 20, w: 30, h: 30 }

describe('geometry', () => {
  it('keeps rooms inside the site when moving', () => {
    const moved = moveRoom(base, 80, 80, false)
    expect(moved.x + moved.w).toBeLessThanOrEqual(100)
    expect(moved.y + moved.h).toBeLessThanOrEqual(100)
    expect(moved.x).toBeGreaterThanOrEqual(0)
    expect(moved.y).toBeGreaterThanOrEqual(0)
  })

  it('resizes from the southeast corner', () => {
    const next = resizeRoom(base, 'se', 10, 5, false)
    expect(next.w).toBe(40)
    expect(next.h).toBe(35)
    expect(next.x).toBe(20)
    expect(next.y).toBe(20)
  })

  it('resizes from the northwest corner without flipping', () => {
    const next = resizeRoom(base, 'nw', 10, 10, false)
    expect(next.w).toBe(20)
    expect(next.h).toBe(20)
    expect(next.x).toBe(30)
    expect(next.y).toBe(30)
  })

  it('scales from center and clamps', () => {
    const next = scaleRoomFromCenter(base, 2, false)
    const clamped = clampRoom({ x: next.x, y: next.y, w: next.w, h: next.h })
    expect({ x: next.x, y: next.y, w: next.w, h: next.h }).toEqual(clamped)
    expect(next.w).toBeGreaterThan(base.w)
    expect(next.h).toBeGreaterThan(base.h)
  })

  it('snaps a rough drawn loop to a clean grid rectangle', () => {
    const points = Array.from({ length: 40 }, (_, i) => {
      const t = (i / 40) * 2 * Math.PI
      return { x: 45 + 15 * Math.cos(t) + (i % 2) * 0.8, y: 42 + 12 * Math.sin(t) - (i % 3) * 0.5 }
    })
    const rect = strokeToRoomRect(points)
    expect(rect).not.toBeNull()
    expect(rect!.x % 1).toBe(0)
    expect(rect!.w).toBeGreaterThanOrEqual(28)
    expect(rect!.h).toBeGreaterThanOrEqual(22)
    expect(rect!.x + rect!.w).toBeLessThanOrEqual(100)
    expect(rect!.y + rect!.h).toBeLessThanOrEqual(100)
  })

  it('rejects taps and single lines as rooms', () => {
    expect(strokeToRoomRect([{ x: 10, y: 10 }, { x: 11, y: 10 }])).toBeNull()
    const line = Array.from({ length: 20 }, (_, i) => ({ x: 10 + i * 3, y: 20 + (i % 2) }))
    expect(strokeToRoomRect(line)).toBeNull()
  })

  it('snaps a nearby opening onto the closest wall with matching rotation', () => {
    const near: Opening = { id: 'w', type: 'window', x: 35, y: 22.5, rotation: 0 }
    const snapped = snapOpeningToWall(near, [base])
    expect(snapped.y).toBe(20) // north wall of base room
    expect(snapped.rotation).toBe(0)

    const nearWest: Opening = { id: 'w', type: 'window', x: 22, y: 35, rotation: 0 }
    const snappedWest = snapOpeningToWall(nearWest, [base])
    expect(snappedWest.x).toBe(20) // west wall
    expect(snappedWest.rotation).toBe(90)
  })

  it('leaves far-off openings untouched instead of teleporting them', () => {
    const far: Opening = { id: 'w', type: 'window', x: 80, y: 80, rotation: 0 }
    expect(snapOpeningToWall(far, [base])).toEqual(far)
  })
})
