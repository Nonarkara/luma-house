import { describe, expect, it } from 'vitest'
import { alignEdges, alignMovedRect, alignTolerance, edgesForHandle, moveOpening, resizeOpening } from './geometry'
import type { Opening } from '../types'

const site = { w: 14, h: 10 }
const tol = alignTolerance(site) // 0.3 m → 2.14% across, 3% down

describe('magnetic wall alignment', () => {
  it('pulls a wall 0.28 m off its neighbour onto one line', () => {
    // The sample's jog: north partition at 44.75%, south partition at 46.75% (0.28 m).
    const living = { x: 18.75, y: 50, w: 28, h: 40 }
    const bedroom = { x: 18.75, y: 20, w: 26, h: 30 }
    const { rect, guides } = alignEdges(bedroom, ['right'], [living], tol)
    expect(rect.x + rect.w).toBeCloseTo(46.75, 9)
    expect(rect.x).toBe(18.75)
    expect(guides.x).toEqual([46.75])
  })

  it('leaves a deliberate 0.84 m step alone', () => {
    const { rect, guides } = alignEdges({ x: 61.75, y: 20, w: 19.5, h: 30 }, ['left'], [{ x: 67.75, y: 50, w: 13.5, h: 40 }], tol)
    expect(rect.x).toBe(61.75)
    expect(guides.x).toEqual([])
  })

  it('moves a whole room to the nearest line without changing its size', () => {
    const { rect, guides } = alignMovedRect({ x: 31, y: 10, w: 20, h: 20 }, [{ x: 10, y: 10, w: 20, h: 20 }], tol)
    expect(rect).toEqual({ x: 30, y: 10, w: 20, h: 20 })
    expect(guides.x).toEqual([30])
    expect(guides.y).toEqual([10])
  })

  it('maps resize handles to the edges they move', () => {
    expect(edgesForHandle('se')).toEqual(['right', 'bottom'])
    expect(edgesForHandle('w')).toEqual(['left'])
  })
})

describe('door and window resize by dragging an end', () => {
  const door: Opening = { id: 'd', type: 'door', x: 50, y: 50, rotation: 0 }

  it('widens from the right end in 5 cm steps and keeps the left end fixed', () => {
    // +0.31 m dragged → 0.9 + 0.31 = 1.21 → 1.20 m.
    const next = resizeOpening(door, 'end', (0.31 / 14) * 100, site, 0.9)
    expect(next.widthM).toBe(1.2)
    const leftBefore = 50 - (0.45 / 14) * 100
    const leftAfter = next.x - (0.6 / 14) * 100
    expect(leftAfter).toBeCloseTo(leftBefore, 9)
  })

  it('narrows from the left end and never below the minimum', () => {
    const next = resizeOpening(door, 'start', (2 / 14) * 100, site, 0.9)
    expect(next.widthM).toBe(0.6)
  })

  it('resizes vertical-wall openings along y', () => {
    const window: Opening = { id: 'w', type: 'window', x: 20, y: 40, rotation: 90 }
    const next = resizeOpening(window, 'end', (0.4 / 10) * 100, site, 1.6)
    expect(next.widthM).toBe(2)
    expect(next.x).toBe(20)
    expect(next.y).toBeCloseTo(40 + (0.2 / 10) * 100, 9)
  })
})

describe('dragging a door along its wall', () => {
  // Two rooms meet at x = 46.75; the shared horizontal wall is y = 46.4286.
  const rooms = [
    { id: 'a', name: 'A', kind: 'living' as const, x: 18.75, y: 46.4286, w: 28, h: 32 },
    { id: 'b', name: 'B', kind: 'kitchen' as const, x: 46.75, y: 46.4286, w: 21, h: 32 },
    { id: 'c', name: 'C', kind: 'bedroom' as const, x: 18.75, y: 21.43, w: 28, h: 25 },
  ]
  const door: Opening = { id: 'd', type: 'door', x: 41.79, y: 46.4286, rotation: 0 }

  it('stays on its wall past a T-junction instead of jumping to the cross wall', () => {
    // 41.79 + 5.0 = 46.79 → grid 47, which is 0.25 from the cross wall but
    // only because the grid also rounded y off the wall line (46.43 → 46).
    const next = moveOpening(door, 5.0, 0, true, rooms)
    expect(next.rotation).toBe(0)
    expect(next.y).toBe(46.4286)
    expect(next.x).toBe(47) // grid-snapped along the wall only
  })

  it('still moves to another wall when dragged clearly onto it', () => {
    const next = moveOpening(door, 46.75 - 41.79, -12, true, rooms)
    expect(next.rotation).toBe(90)
    expect(next.x).toBe(46.75)
  })
})
