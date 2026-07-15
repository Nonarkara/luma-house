import { describe, expect, it } from 'vitest'
import { clampRoom, moveRoom, resizeRoom, scaleRoomFromCenter } from './geometry'
import type { Room } from '../types'

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
})
